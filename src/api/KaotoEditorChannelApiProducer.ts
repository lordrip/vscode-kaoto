import { BackendProxy } from '@kie-tools-core/backend/dist/api';
import { KogitoEditorChannelApi } from '@kie-tools-core/editor/dist/api';
import { I18n } from '@kie-tools-core/i18n/dist/core';
import { NotificationsChannelApi } from '@kie-tools-core/notifications/dist/api';
import { VsCodeKieEditorChannelApiProducer } from '@kie-tools-core/vscode-extension/dist/VsCodeKieEditorChannelApiProducer';
import { VsCodeKieEditorController } from '@kie-tools-core/vscode-extension/dist/VsCodeKieEditorController';
import { VsCodeI18n } from '@kie-tools-core/vscode-extension/dist/i18n';
import { JavaCodeCompletionApi } from '@kie-tools-core/vscode-java-code-completion/dist/api';
import { ResourceContentService, WorkspaceChannelApi } from '@kie-tools-core/workspace/dist/api';
import { KubernetesService } from '../services/KubernetesService';
import { KaotoEditorChannelApiImpl } from './KaotoEditorChannelApiImpl';

export class KaotoEditorChannelApiProducer implements VsCodeKieEditorChannelApiProducer {
  constructor(private readonly options: { k8s: KubernetesService }) {}

  get(
    editor: VsCodeKieEditorController,
    resourceContentService: ResourceContentService,
    vscodeWorkspace: WorkspaceChannelApi,
    backendProxy: BackendProxy,
    vscodeNotifications: NotificationsChannelApi,
    javaCodeCompletionApi: JavaCodeCompletionApi,
    viewType: string,
    i18n: I18n<VsCodeI18n>
  ): KogitoEditorChannelApi {
    return new KaotoEditorChannelApiImpl(
      editor,
      resourceContentService,
      vscodeWorkspace,
      backendProxy,
      vscodeNotifications,
      javaCodeCompletionApi,
      viewType,
      i18n,
      this.options.k8s
    );
  }
}
