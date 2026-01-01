import metadata from '../../metadata.json';
import { Metadata } from '../types';

export const useMetadata = (): Metadata => {
  return metadata as Metadata;
};

export const appConfig = {
    ...metadata,
    theme: {
        primary: '#A8C7FA',
        secondary: '#C2E7FF',
        tertiary: '#D7C3FA',
    }
}
