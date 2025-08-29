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
import { InfraServiceStatus, ConnectionParams } from './InfrastructureItem';

export class InfraImplementationItem extends TreeItem {
	constructor(
		public readonly parentAlias: string,
		public readonly implementation: string,
		public readonly status: InfraServiceStatus = 'stopped',
		public readonly pid?: number,
		public readonly connectionParams?: ConnectionParams,
	) {
		super(implementation, TreeItemCollapsibleState.None);
		
		this.description = this.getDescription();
		this.tooltip = this.getTooltip();
		this.iconPath = this.getIcon();
		this.contextValue = this.getContextValue();
	}

	private getDescription(): string {
		switch (this.status) {
			case 'running':
				const connection = this.connectionParams?.url || 
					(this.connectionParams?.host && this.connectionParams?.port 
						? `${this.connectionParams.host}:${this.connectionParams.port}`
						: '');
				return connection ? `🟢 ${connection}` : '🟢 running';
			case 'starting':
				return '🟡 starting...';
			case 'stopping':
				return '🟡 stopping...';
			default:
				return '⚫ stopped';
		}
	}

	private getTooltip(): string {
		let tooltip = `${this.parentAlias} - ${this.implementation} implementation`;
		
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
		return `infrastructure-implementation-${this.status}`;
	}

	public getFullAlias(): string {
		return `${this.parentAlias}:${this.implementation}`;
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