import { ValueTransformer } from 'typeorm';
import { Identification } from './identification.vo';

export class IdentificationTransformer implements ValueTransformer {
  to(value: Identification | string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    if (value instanceof Identification) {
      return value.getValue();
    }

    return value;
  }

  from(value: string | null | undefined): Identification | null {
    if (!value) {
      return null;
    }

    return Identification.from(value);
  }
}

