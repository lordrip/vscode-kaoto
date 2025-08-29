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
import { TreeItem, TreeItemCollapsibleState, ThemeIcon } from 'vscode';

export type InfraServiceStatus = 'stopped' | 'running' | 'starting' | 'stopping';

export interface ConnectionParams {
	url?: string;
	host?: string;
	port?: number;
	username?: string;
	password?: string;
	containerId?: string;
	webUi?: string;
	database?: string;
	[key: string]: any;
}

export interface InfraServiceState {
	alias: string;
	description: string;
	aliasImplementation: string;
	status: InfraServiceStatus;
	pid?: number;
	connectionParams?: ConnectionParams;
	startupOutput?: string;
}

export class InfrastructureItem extends TreeItem {
	public state: InfraServiceState;

	constructor(
		public readonly alias: string,
		public readonly description: string,
		public readonly aliasImplementation: string,
		public readonly status: InfraServiceStatus = 'stopped',
		public readonly pid?: number,
		public readonly connectionParams?: ConnectionParams,
	) {
		super(alias, TreeItemCollapsibleState.None);
		
		this.state = {
			alias,
			description,
			aliasImplementation,
			status,
			pid,
			connectionParams,
		};

		this.label = this.getDisplayLabel();
		this.description = this.getDescription();
		this.tooltip = this.getTooltip();
		this.iconPath = this.getIcon();
		this.contextValue = this.getContextValue();
	}

	private getDisplayLabel(): string {
		const implementations = this.aliasImplementation 
			? ` (${this.aliasImplementation.split(',').length} impl)` 
			: '';
		
		// Add visual indicator for running services
		const statusIcon = this.status === 'running' ? '🟢 ' : 
						   this.status === 'starting' ? '🟡 ' :
						   this.status === 'stopping' ? '🟡 ' : '';
		
		return `${statusIcon}${this.alias}${implementations}`;
	}

	private getDescription(): string {
		switch (this.status) {
			case 'running':
				const connection = this.connectionParams?.url || 
					(this.connectionParams?.host && this.connectionParams?.port 
						? `${this.connectionParams.host}:${this.connectionParams.port}`
						: '');
				return connection ? `RUNNING - ${connection}` : 'RUNNING';
			case 'starting':
				return 'STARTING...';
			case 'stopping':
				return 'STOPPING...';
			default:
				return this.description; // Show description when stopped
		}
	}

	private getTooltip(): string {
		let tooltip = `${this.description}\nAlias: ${this.alias}`;
		
		if (this.aliasImplementation) {
			tooltip += `\nImplementations: ${this.aliasImplementation}`;
		}
		
		if (this.status === 'running' && this.connectionParams) {
			tooltip += '\n\nConnection Parameters:';
			Object.entries(this.connectionParams).forEach(([key, value]) => {
				if (value) {
					tooltip += `\n${key}: ${value}`;
				}
			});
		}
		
		if (this.pid) {
			tooltip += `\nPID: ${this.pid}`;
		}

		return tooltip;
	}

	private getIcon(): ThemeIcon {
		switch (this.status) {
			case 'running':
				return new ThemeIcon('server', { id: 'server' });
			case 'starting':
				return new ThemeIcon('loading~spin');
			case 'stopping':
				return new ThemeIcon('loading~spin');
			default:
				return new ThemeIcon('server-process', { id: 'server-process' });
		}
	}

	private getContextValue(): string {
		return `infrastructure-${this.status}`;
	}

	public updateState(newState: Partial<InfraServiceState>): void {
		this.state = { ...this.state, ...newState };
		
		// Update tree item properties
		this.label = this.getDisplayLabel();
		this.description = this.getDescription();
		this.tooltip = this.getTooltip();
		this.iconPath = this.getIcon();
		this.contextValue = this.getContextValue();
	}

	public isRunning(): boolean {
		return this.status === 'running';
	}

	public isStopped(): boolean {
		return this.status === 'stopped';
	}

	public canStart(): boolean {
		return this.status === 'stopped';
	}

	public canStop(): boolean {
		return this.status === 'running';
	}
}