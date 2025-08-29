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
import { ShellExecution, TaskScope } from 'vscode';
import { CamelJBangTask } from './CamelJBangTask';

export class CamelInfraListJBangTask extends CamelJBangTask {
	private constructor(shellExecution: ShellExecution) {
		super(TaskScope.Workspace, 'List Infrastructure Services', shellExecution, true);
	}

	static create(): CamelInfraListJBangTask {
		const shellExecution = new ShellExecution('camel', ['infra', 'list', '--json']);
		return new CamelInfraListJBangTask(shellExecution);
	}
}