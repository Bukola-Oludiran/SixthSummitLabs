import { Plugin } from '@nocobase/client';
import models from './models';
import CrmWorkspace from '../client-v2/CrmWorkspace';

export class PluginSixsummitCrmClient extends Plugin {
  async load() {
    this.flowEngine.registerModels(models);
    this.app.router.add('admin.sixsummit', {
      path: '/admin/sixsummit',
      Component: CrmWorkspace,
    });
  }
}

export default PluginSixsummitCrmClient;
