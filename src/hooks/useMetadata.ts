import metadata from '../../metadata.json';
import { Metadata } from '../types';

export const useMetadata = (): Metadata => {
  return metadata as Metadata;
};

export const appConfig = {
    ...metadata,
    theme: {
        primary: '#6750A4',
        secondary: '#625B71',
        tertiary: '#7D5260',
    }
}
