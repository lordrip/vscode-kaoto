import { CoreV1Api, KubeConfig, V1ConfigMapList, V1NamespaceList } from '@kubernetes/client-node';

export class KubernetesService {
  async getNamespaces(): Promise<string | undefined> {
    const kc = new KubeConfig();
    kc.loadFromDefault();

    const k8sApi = kc.makeApiClient(CoreV1Api);
    let namespaces: V1NamespaceList | undefined;
    let configMaps: V1ConfigMapList | undefined;

    try {
      const listConfigMapsResponse = await k8sApi.listNamespacedConfigMap('rm066rh-dev')
      configMaps = listConfigMapsResponse.body;
    } catch (error) {
      console.error('Error loading pods:', error);
    }

    return configMaps?.items.map((item) => item.metadata?.name).join(', ');
  }
}
