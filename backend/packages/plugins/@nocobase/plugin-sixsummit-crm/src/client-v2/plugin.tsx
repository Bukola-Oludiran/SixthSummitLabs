import { Plugin } from '@nocobase/client-v2';

export class PluginSixsummitCrmClientV2 extends Plugin {
  async load() {
    this.router.add('admin.sixsummit', {
      path: '/admin/sixsummit',
      componentLoader: () => import('./CrmWorkspace'),
    });
  }
}

export default PluginSixsummitCrmClientV2;
