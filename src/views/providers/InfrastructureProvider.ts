/**
 * Copyright 2025 Red Hat, Inc. and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState, ThemeIcon, workspace, window, tasks, TaskScope } from 'vscode';
import { KaotoOutputChannel } from '../../extension/KaotoOutputChannel';
import { InfrastructureItem, InfraServiceState } from '../infrastructureTreeItems/InfrastructureItem';
import { InfraRootItem } from '../infrastructureTreeItems/InfraRootItem';
import { InfraImplementationItem } from '../infrastructureTreeItems/InfraImplementationItem';
import { CamelJBang } from '../../helpers/CamelJBang';

interface InfraServiceData {
	alias: string;
	description: string;
	aliasImplementation: string;
}

interface RunningServiceInfo {
	pid: number;
	alias: string;
	implementation: string;
	description: string;
}

export class InfrastructureProvider implements TreeDataProvider<TreeItem> {
	private readonly _onDidChangeTreeData = new EventEmitter<TreeItem | undefined | null | void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private readonly CONTEXT_ROOT_ITEM = 'infrastructure-root';
	private availableServices: InfraServiceData[] = [];
	private runningServices: Map<string, RunningServiceInfo> = new Map();
	private serviceStates: Map<string, InfraServiceState> = new Map();
	private refreshInterval?: NodeJS.Timeout;
	private isLoading: boolean = false;
	private servicesLoaded: boolean = false;
	private camelJBang: CamelJBang;

	constructor() {
		this.camelJBang = new CamelJBang();
		// Load services asynchronously to avoid blocking UI
		this.loadAvailableServicesAsync();
		this.startPeriodicRefresh();
	}

	dispose(): void {
		if (this.refreshInterval) {
			clearInterval(this.refreshInterval);
		}
	}

	refresh(): void {
		KaotoOutputChannel.logInfo('[InfrastructureProvider] Refreshing infrastructure data...');
		// Only load available services once, but always refresh running services
		if (!this.servicesLoaded) {
			this.loadAvailableServicesAsync();
		}
		this.loadRunningServicesAsync();
	}

	getTreeItem(element: TreeItem): TreeItem {
		return element;
	}

	async getChildren(element?: TreeItem): Promise<TreeItem[]> {
		if (!element) {
			return [new InfraRootItem('Infrastructure', 'server-environment', this.CONTEXT_ROOT_ITEM)];
		}

		if (element.contextValue === this.CONTEXT_ROOT_ITEM) {
			return this.getInfrastructureServices();
		}

		if (element instanceof InfrastructureItem && element.aliasImplementation) {
			return this.getImplementationItems(element);
		}

		return [];
	}

	private getInfrastructureServices(): TreeItem[] {
		if (this.availableServices.length === 0 && this.isLoading) {
			// Show loading message
			const loadingItem = new TreeItem('Loading infrastructure services...');
			loadingItem.iconPath = new ThemeIcon('loading~spin');
			loadingItem.contextValue = 'loading';
			return [loadingItem];
		}

		if (this.availableServices.length === 0) {
			// Show empty state
			const emptyItem = new TreeItem('No infrastructure services available');
			emptyItem.iconPath = new ThemeIcon('warning');
			emptyItem.contextValue = 'empty';
			return [emptyItem];
		}

		const items = this.availableServices.map(service => {
			const runningInfo = this.runningServices.get(service.alias);
			const hasImplementations = service.aliasImplementation && service.aliasImplementation.trim() !== '';
			
			const item = new InfrastructureItem(
				service.alias,
				service.description,
				service.aliasImplementation,
				runningInfo ? 'running' : 'stopped',
				runningInfo?.pid
			);

			// Set collapsible state if service has implementations
			if (hasImplementations) {
				item.collapsibleState = TreeItemCollapsibleState.Collapsed;
			}

			return item;
		});

		// Sort running services to the top
		return items.sort((a, b) => {
			const aRunning = a.status === 'running' ? 1 : 0;
			const bRunning = b.status === 'running' ? 1 : 0;
			
			if (aRunning !== bRunning) {
				return bRunning - aRunning; // Running services first
			}
			
			// Within same status group, sort alphabetically
			return a.alias.localeCompare(b.alias);
		});
	}

	private async executeShellCommand(shellExecution: any, timeout: number = 15000): Promise<{success: boolean, output?: string, error?: string}> {
		return new Promise((resolve) => {
			const { spawn } = require('child_process');
			
			// Extract command and arguments from ShellExecution
			const command = shellExecution.command;
			const args = shellExecution.args || [];
			const options = shellExecution.options || {};
			
			KaotoOutputChannel.logInfo(`[InfrastructureProvider] Executing: ${command} ${args.join(' ')}`);
			
			// Use the environment from ShellExecution options, or fallback to process.env
			const env = options.env || { ...process.env };
			
			const childProcess = spawn(command, args, {
				env: env,
				shell: true,
				cwd: options.cwd
			});
			
			let output = '';
			let errorOutput = '';
			let timeoutHandle: NodeJS.Timeout;
			
			// Set timeout
			timeoutHandle = setTimeout(() => {
				childProcess.kill('SIGTERM');
				resolve({ success: false, error: `Command timed out after ${timeout}ms` });
			}, timeout);
			
			childProcess.stdout.on('data', (data: Buffer) => {
				output += data.toString();
			});
			
			childProcess.stderr.on('data', (data: Buffer) => {
				errorOutput += data.toString();
			});
			
			childProcess.on('close', (code: number) => {
				clearTimeout(timeoutHandle);
				if (code === 0) {
					resolve({ success: true, output: output });
				} else {
					resolve({ success: false, error: errorOutput || `Process exited with code ${code}` });
				}
			});
			
			childProcess.on('error', (error: Error) => {
				clearTimeout(timeoutHandle);
				resolve({ success: false, error: error.message });
			});
		});
	}

	private getImplementationItems(parentItem: InfrastructureItem): TreeItem[] {
		if (!parentItem.aliasImplementation) {
			return [];
		}

		const implementations = parentItem.aliasImplementation
			.split(',')
			.map(impl => impl.trim())
			.filter(impl => impl.length > 0);

		return implementations.map(impl => {
			const fullAlias = `${parentItem.alias}:${impl}`;
			const runningInfo = this.runningServices.get(fullAlias);

			return new InfraImplementationItem(
				parentItem.alias,
				impl,
				runningInfo ? 'running' : 'stopped',
				runningInfo?.pid
			);
		});
	}

	private async loadAvailableServicesAsync(): Promise<void> {
		try {
			KaotoOutputChannel.logInfo('[InfrastructureProvider] Loading available services...');
			
			// Set loading state and show tree immediately
			this.isLoading = true;
			this._onDidChangeTreeData.fire();
			
			const result = await this.executeShellCommand(this.camelJBang.infraList());
			
			if (result.success && result.output) {
				try {
					// Extract JSON from output that may contain log messages
					const jsonStart = result.output.indexOf('[');
					const jsonEnd = result.output.lastIndexOf(']');
					
					if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
						const jsonString = result.output.substring(jsonStart, jsonEnd + 1);
						this.availableServices = JSON.parse(jsonString) as InfraServiceData[];
						KaotoOutputChannel.logInfo(`[InfrastructureProvider] Loaded ${this.availableServices.length} available services`);
					} else {
						// Fallback: try to parse the entire output
						this.availableServices = JSON.parse(result.output) as InfraServiceData[];
						KaotoOutputChannel.logInfo(`[InfrastructureProvider] Loaded ${this.availableServices.length} available services`);
					}
					this.servicesLoaded = true;
				} catch (parseError) {
					KaotoOutputChannel.logError('[InfrastructureProvider] Failed to parse services JSON:', parseError);
					KaotoOutputChannel.logError('[InfrastructureProvider] Raw output:', result.output?.substring(0, 200));
					this.availableServices = [];
				}
			} else {
				KaotoOutputChannel.logError(`[InfrastructureProvider] Failed to load services: ${result.error}`);
				this.availableServices = [];
			}
			
		} catch (error) {
			KaotoOutputChannel.logError('[InfrastructureProvider] Failed to load available services:', error);
			this.availableServices = [];
		} finally {
			this.isLoading = false;
			this._onDidChangeTreeData.fire();
		}
	}

	private async loadRunningServicesAsync(): Promise<void> {
		try {
			KaotoOutputChannel.logInfo('[InfrastructureProvider] Loading running services...');
			
			const result = await this.executeShellCommand(this.camelJBang.infraPs());
			
			if (result.success && result.output) {
				this.parseRunningServices(result.output);
			} else {
				KaotoOutputChannel.logError(`[InfrastructureProvider] Failed to load running services: ${result.error}`);
				this.runningServices.clear();
			}
			this._onDidChangeTreeData.fire();
			
		} catch (error) {
			KaotoOutputChannel.logError('[InfrastructureProvider] Failed to load running services:', error);
			this.runningServices.clear();
		}
	}

	private parseRunningServices(output: string): void {
		this.runningServices.clear();
		
		try {
			KaotoOutputChannel.logInfo(`[InfrastructureProvider] Parsing infra ps JSON output:\n${output}`);
			
			// Extract JSON from output that may contain log messages (same as infraList)
			const jsonStart = output.indexOf('[');
			const jsonEnd = output.lastIndexOf(']');
			
			if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
				const jsonString = output.substring(jsonStart, jsonEnd + 1);
				const runningServicesData = JSON.parse(jsonString) as { description: string, alias: string, aliasImplementation: string }[];
				
				for (const service of runningServicesData) {
					// For running services from ps --json, we don't get PID, but we know they're running
					const key = service.aliasImplementation && service.aliasImplementation.trim() !== '' ? 
						`${service.alias}:${service.aliasImplementation}` : service.alias;
					
					this.runningServices.set(key, {
						pid: 0, // We don't get PID from ps --json, but it's not critical
						alias: service.alias,
						implementation: service.aliasImplementation || '-',
						description: service.description
					});
					
					KaotoOutputChannel.logInfo(`[InfrastructureProvider] Added running service with key: ${key}`);
				}
			} else {
				// Fallback: try to parse the entire output
				const runningServicesData = JSON.parse(output) as { description: string, alias: string, aliasImplementation: string }[];
				
				for (const service of runningServicesData) {
					const key = service.aliasImplementation && service.aliasImplementation.trim() !== '' ? 
						`${service.alias}:${service.aliasImplementation}` : service.alias;
					
					this.runningServices.set(key, {
						pid: 0,
						alias: service.alias,
						implementation: service.aliasImplementation || '-',
						description: service.description
					});
				}
			}
			
			KaotoOutputChannel.logInfo(`[InfrastructureProvider] Found ${this.runningServices.size} running services`);
			
		} catch (parseError) {
			KaotoOutputChannel.logError('[InfrastructureProvider] Failed to parse running services JSON:', parseError);
			KaotoOutputChannel.logError('[InfrastructureProvider] Raw output:', output?.substring(0, 200));
			this.runningServices.clear();
		}
	}

	private startPeriodicRefresh(): void {
		// Refresh running services every 10 seconds
		this.refreshInterval = setInterval(() => {
			this.loadRunningServicesAsync();
		}, 10000);
	}

	public async startService(alias: string): Promise<boolean> {
		try {
			KaotoOutputChannel.logInfo(`[InfrastructureProvider] Starting service: ${alias}`);
			
			// Log environment info for Docker/Podman troubleshooting
			const dockerHost = process.env.DOCKER_HOST;
			const xdgRuntimeDir = process.env.XDG_RUNTIME_DIR;
			if (dockerHost) {
				KaotoOutputChannel.logInfo(`[InfrastructureProvider] DOCKER_HOST: ${dockerHost}`);
			}
			if (xdgRuntimeDir) {
				KaotoOutputChannel.logInfo(`[InfrastructureProvider] XDG_RUNTIME_DIR: ${xdgRuntimeDir}`);
			}
			
			// Update UI to show starting state
			this.updateServiceState(alias, 'starting');
			
			// Use CamelJBang helper which handles VS Code configuration and environment
			const result = await this.executeShellCommand(this.camelJBang.infraRun(alias), 120000);
			
			if (result.success) {
				KaotoOutputChannel.logInfo(`[InfrastructureProvider] Service ${alias} started successfully`);
				if (result.output) {
					KaotoOutputChannel.logInfo(`[InfrastructureProvider] Startup output: ${result.output}`);
					// TODO: Parse connection parameters here
				}
				
				// Refresh to get updated running services
				setTimeout(() => this.loadRunningServicesAsync(), 2000);
				return true;
			} else {
				// Check for Docker/Podman specific errors and provide helpful messages
				const error = result.error || '';
				if (error.includes('Could not find a valid Docker environment') || 
					error.includes('testcontainers') ||
					error.includes('DockerClientProviderStrategy')) {
					
					KaotoOutputChannel.logError(`[InfrastructureProvider] Docker/Podman connection error for service ${alias}:`);
					KaotoOutputChannel.logError('This error suggests that Docker or Podman is not properly configured for Testcontainers.');
					KaotoOutputChannel.logError('Possible solutions:');
					KaotoOutputChannel.logError('1. If using Podman: Make sure the socket is available and environment variables are set');
					KaotoOutputChannel.logError('2. If using Docker: Ensure Docker daemon is running and accessible');
					KaotoOutputChannel.logError('3. Try running the same command in terminal first to verify setup');
					KaotoOutputChannel.logError(`Full error: ${error}`);
					
					// Show user-friendly error message
					window.showErrorMessage(
						`Failed to start ${alias}: Docker/Podman connection issue. Check Kaoto Output for details and troubleshooting steps.`,
						'Open Output'
					).then(selection => {
						if (selection === 'Open Output') {
							KaotoOutputChannel.show();
						}
					});
					
				} else {
					KaotoOutputChannel.logError(`[InfrastructureProvider] Failed to start service ${alias}: ${error}`);
				}
				
				this.updateServiceState(alias, 'stopped');
				return false;
			}
			
		} catch (error) {
			KaotoOutputChannel.logError(`[InfrastructureProvider] Failed to start service ${alias}:`, error);
			this.updateServiceState(alias, 'stopped');
			return false;
		}
	}

	public async stopService(alias: string): Promise<boolean> {
		try {
			KaotoOutputChannel.logInfo(`[InfrastructureProvider] Stopping service: ${alias}`);
			
			// Update UI to show stopping state
			this.updateServiceState(alias, 'stopping');
			
			// Use CamelJBang helper which handles VS Code configuration and environment
			const result = await this.executeShellCommand(this.camelJBang.infraStop(alias), 30000);
			
			if (result.success) {
				KaotoOutputChannel.logInfo(`[InfrastructureProvider] Service ${alias} stopped successfully`);
				if (result.output) {
					KaotoOutputChannel.logInfo(`[InfrastructureProvider] Stop output: ${result.output}`);
				}
				
				// Refresh to get updated running services
				setTimeout(() => this.loadRunningServicesAsync(), 1000);
				return true;
			} else {
				KaotoOutputChannel.logError(`[InfrastructureProvider] Failed to stop service ${alias}: ${result.error}`);
				this.updateServiceState(alias, 'running');
				return false;
			}
			
		} catch (error) {
			KaotoOutputChannel.logError(`[InfrastructureProvider] Failed to stop service ${alias}:`, error);
			this.updateServiceState(alias, 'running');
			return false;
		}
	}

	public async getServiceLogs(alias: string): Promise<string> {
		try {
			KaotoOutputChannel.logInfo(`[InfrastructureProvider] Getting logs for service: ${alias}`);
			
			// Use CamelJBang helper which handles VS Code configuration and environment
			const result = await this.executeShellCommand(this.camelJBang.infraLogs(alias), 15000);
			
			if (result.success) {
				return result.output || '';
			} else {
				const errorMsg = `Error getting logs: ${result.error}`;
				KaotoOutputChannel.logError(`[InfrastructureProvider] Failed to get logs for service ${alias}:`, result.error);
				return errorMsg;
			}
			
		} catch (error) {
			const errorMsg = `Error getting logs: ${error}`;
			KaotoOutputChannel.logError(`[InfrastructureProvider] Failed to get logs for service ${alias}:`, error);
			return errorMsg;
		}
	}

	private updateServiceState(alias: string, status: 'running' | 'stopped' | 'starting' | 'stopping'): void {
		const currentState = this.serviceStates.get(alias) || {
			alias,
			description: '',
			aliasImplementation: '',
			status: 'stopped'
		};
		
		this.serviceStates.set(alias, { ...currentState, status });
		this._onDidChangeTreeData.fire();
	}

	public getServiceState(alias: string): InfraServiceState | undefined {
		return this.serviceStates.get(alias);
	}
}