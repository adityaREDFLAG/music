
import metadata from '../metadata.json';

export interface AppConfig {
  name: string;
  description: string;
  themeColor: string;
}

export const config: AppConfig = {
  name: metadata.name,
  description: metadata.description,
  themeColor: '#6750A4', // Default, can be dynamic
};

export default config;
