import { Injectable } from '@angular/core';
import { StealthMode, StealthOptions, StegoGenerator, LogGenerator, CsvGenerator, JsonGenerator } from './generators';

@Injectable({
  providedIn: 'root',
})
export class SteganographyService {
  private generators: Map<StealthMode, StegoGenerator> = new Map<StealthMode, StegoGenerator>();

  constructor() {
    this.generators.set(StealthMode.LOG, new LogGenerator());
    this.generators.set(StealthMode.CSV, new CsvGenerator());
    this.generators.set(StealthMode.JSON, new JsonGenerator());
  }

  public transmute(data: string, mode: StealthMode, options: StealthOptions): string {
    const generator = this.generators.get(mode);
    if (!generator) {
      throw new Error(`Generator for mode ${mode} not implemented or not found.`);
    }
    return generator.generate(data, options);
  }

  public extract(fileContent: string, mode: StealthMode): string {
    const generator = this.generators.get(mode);
    if (!generator) {
      throw new Error(`Generator for mode ${mode} not implemented or not found.`);
    }
    return generator.extract(fileContent);
  }

  /**
   * Detects the stealth mode used in a file based on its extension or content.
   *
   * @param filename The name of the file.
   * @param content The content of the file (unused in current implementation but reserved for content sniffing).
   * @returns The detected StealthMode or null if detection fails.
   */
  public detectMode(filename: string, content: string): StealthMode | null {
    // Basic validation to ensure content is present
    if (!content) return null;

    if (filename.endsWith('.log')) return StealthMode.LOG;
    if (filename.endsWith('.csv')) return StealthMode.CSV;
    if (filename.endsWith('.json')) return StealthMode.JSON;
    return null;
  }
}
