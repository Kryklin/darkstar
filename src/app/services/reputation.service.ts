import { Injectable, inject, computed } from '@angular/core';
import { VaultService, VaultTrustNode } from './vault';

@Injectable({
  providedIn: 'root'
})
export class ReputationService {
  private vaultService = inject(VaultService);

  // Computed map for fast lookups
  private trustMap = computed(() => {
      const map = new Map<string, VaultTrustNode>();
      this.vaultService.trustGraph().forEach(node => map.set(node.onionAddress, node));
      return map;
  });

  getReputation(onionAddress: string): VaultTrustNode | undefined {
      return this.trustMap().get(onionAddress);
  }

  updateReputation(onionAddress: string, score: number, alias?: string, notes?: string) {
      this.vaultService.trustGraph.update(graph => {
          const index = graph.findIndex(n => n.onionAddress === onionAddress);
          if (index >= 0) {
              const node = graph[index];
              return [
                ...graph.slice(0, index),
                { ...node, score, lastInteracted: Date.now(), alias: alias || node.alias, notes: notes || node.notes },
                ...graph.slice(index + 1)
              ];
          } else {
              return [
                  ...graph,
                  { onionAddress, score, lastInteracted: Date.now(), alias, notes }
              ];
          }
      });
      // Persist changes
      this.vaultService.save().catch(e => console.error('Failed to save reputation:', e));
  }

  formatScore(score: number): string {
      if (score >= 90) return 'Trusted';
      if (score >= 70) return 'Good';
      if (score >= 50) return 'Neutral';
      if (score >= 20) return 'Suspicious';
      return 'Untrusted';
  }

  getClassForScore(score: number): string {
      if (score >= 70) return 'score-high';
      if (score >= 50) return 'score-medium';
      return 'score-low';
  }
}
