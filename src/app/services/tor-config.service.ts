import { Injectable } from '@angular/core';

export interface TorConfig {
  useBridges: boolean;
  bridgeLines: string;
}

@Injectable({
  providedIn: 'root'
})
export class TorConfigService {


  async getTorConfig(): Promise<TorConfig> {
    if (window.electronAPI) {
        return await window.electronAPI.torGetConfig();
    }
    return { useBridges: false, bridgeLines: '' };
  }

  async saveTorConfig(config: TorConfig): Promise<boolean> {
    if (window.electronAPI) {
        return await window.electronAPI.torSaveConfig(config);
    }
    return false;
  }
}
