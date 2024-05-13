import { KaotoEditorChannelApi } from '@kaoto/kaoto';
import { BackendProxy } from '@kie-tools-core/backend/dist/api';
import { I18n } from '@kie-tools-core/i18n/dist/core';
import { NotificationsChannelApi } from '@kie-tools-core/notifications/dist/api';
import { DefaultVsCodeKieEditorChannelApiImpl } from '@kie-tools-core/vscode-extension/dist/DefaultVsCodeKieEditorChannelApiImpl';
import { VsCodeKieEditorController } from '@kie-tools-core/vscode-extension/dist/VsCodeKieEditorController';
import { VsCodeI18n } from '@kie-tools-core/vscode-extension/dist/i18n';
import { JavaCodeCompletionApi } from '@kie-tools-core/vscode-java-code-completion/dist/api';
import { ResourceContentService, WorkspaceChannelApi } from '@kie-tools-core/workspace/dist/api';
import { CoreV1Api, KubeConfig, V1NamespaceList } from '@kubernetes/client-node';
import { KubernetesService } from '../services/KubernetesService';

export class KaotoEditorChannelApiImpl
  extends DefaultVsCodeKieEditorChannelApiImpl
  implements KaotoEditorChannelApi
{
  constructor(
    editor: VsCodeKieEditorController,
    resourceContentService: ResourceContentService,
    workspaceApi: WorkspaceChannelApi,
    backendProxy: BackendProxy,
    notificationsApi: NotificationsChannelApi,
    javaCodeCompletionApi: JavaCodeCompletionApi,
    viewType: string,
    i18n: I18n<VsCodeI18n>,
    private readonly k8s: KubernetesService
  ) {
    super(
      editor,
      resourceContentService,
      workspaceApi,
      backendProxy,
      notificationsApi,
      javaCodeCompletionApi,
      viewType,
      i18n
    );
  }

  async getExample(): Promise<string | undefined> {
    const namespaces = this.k8s.getNamespaces();

    return namespaces;
  }
}
