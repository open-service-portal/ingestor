import { KubernetesEntityProvider } from './KubernetesEntityProvider';
import { BackstageLink } from '../interfaces';

describe('KubernetesEntityProvider', () => {
  describe('generateLinksFromXRStatus', () => {
    let provider: any;

    beforeEach(() => {
      // Create a minimal mock provider to test the private method
      provider = new KubernetesEntityProvider(
        {} as any,
        { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any,
        { getOptionalString: () => 'terasky.backstage.io' } as any,
        {} as any,
      );
    });

    // Access private method for testing
    const callGenerateLinksFromXRStatus = (xr: any): BackstageLink[] => {
      return (provider as any).generateLinksFromXRStatus(xr);
    };

    it('should return empty array when status is missing', () => {
      const xr = { metadata: { name: 'test-xr' } };
      const links = callGenerateLinksFromXRStatus(xr);
      expect(links).toEqual([]);
    });

    it('should extract domain from status', () => {
      const xr = {
        status: {
          domain: 'example.com'
        }
      };
      const links = callGenerateLinksFromXRStatus(xr);
      expect(links).toContainEqual({
        url: 'https://example.com',
        title: 'Service Domain',
        icon: 'WebAsset'
      });
    });

    it('should create DNS query link for FQDN', () => {
      const xr = {
        status: {
          fqdn: 'service.example.com'
        }
      };
      const links = callGenerateLinksFromXRStatus(xr);
      expect(links).toContainEqual({
        url: 'https://dns.google/query?name=service.example.com&type=ALL',
        title: 'DNS Query (Google)',
        icon: 'DNS'
      });
    });

    it('should extract URL from status', () => {
      const xr = {
        status: {
          url: 'https://api.example.com'
        }
      };
      const links = callGenerateLinksFromXRStatus(xr);
      expect(links).toContainEqual({
        url: 'https://api.example.com',
        title: 'Service URL',
        icon: 'WebAsset'
      });
    });

    it('should extract ingress host from status', () => {
      const xr = {
        status: {
          ingress: {
            host: 'app.example.com'
          }
        }
      };
      const links = callGenerateLinksFromXRStatus(xr);
      expect(links).toContainEqual({
        url: 'https://app.example.com',
        title: 'Ingress URL',
        icon: 'WebAsset'
      });
    });

    it('should handle string endpoint', () => {
      const xr = {
        status: {
          endpoint: 'service.local:8080'
        }
      };
      const links = callGenerateLinksFromXRStatus(xr);
      expect(links).toContainEqual({
        url: 'https://service.local:8080',
        title: 'Endpoint',
        icon: 'WebAsset'
      });
    });

    it('should handle endpoint with http prefix', () => {
      const xr = {
        status: {
          endpoint: 'http://service.local:8080'
        }
      };
      const links = callGenerateLinksFromXRStatus(xr);
      expect(links).toContainEqual({
        url: 'http://service.local:8080',
        title: 'Endpoint',
        icon: 'WebAsset'
      });
    });

    it('should handle object endpoint', () => {
      const xr = {
        status: {
          endpoint: {
            url: 'https://custom.endpoint.com',
            title: 'Custom Endpoint',
            icon: 'Cloud'
          }
        }
      };
      const links = callGenerateLinksFromXRStatus(xr);
      expect(links).toContainEqual({
        url: 'https://custom.endpoint.com',
        title: 'Custom Endpoint',
        icon: 'Cloud'
      });
    });

    it('should handle endpoints array with strings', () => {
      const xr = {
        status: {
          endpoints: [
            'endpoint1.com',
            'http://endpoint2.com'
          ]
        }
      };
      const links = callGenerateLinksFromXRStatus(xr);
      expect(links).toContainEqual({
        url: 'https://endpoint1.com',
        title: 'Endpoint 1',
        icon: 'WebAsset'
      });
      expect(links).toContainEqual({
        url: 'http://endpoint2.com',
        title: 'Endpoint 2',
        icon: 'WebAsset'
      });
    });

    it('should handle endpoints array with objects', () => {
      const xr = {
        status: {
          endpoints: [
            { url: 'https://api.example.com', title: 'API' },
            { url: 'https://web.example.com', name: 'Web UI' }
          ]
        }
      };
      const links = callGenerateLinksFromXRStatus(xr);
      expect(links).toContainEqual({
        url: 'https://api.example.com',
        title: 'API',
        icon: 'WebAsset'
      });
      expect(links).toContainEqual({
        url: 'https://web.example.com',
        title: 'Web UI',
        icon: 'WebAsset'
      });
    });

    it('should handle URLs array', () => {
      const xr = {
        status: {
          urls: [
            'https://url1.com',
            { href: 'https://url2.com', title: 'Second URL' }
          ]
        }
      };
      const links = callGenerateLinksFromXRStatus(xr);
      expect(links).toContainEqual({
        url: 'https://url1.com',
        title: 'URL 1',
        icon: 'WebAsset'
      });
      expect(links).toContainEqual({
        url: 'https://url2.com',
        title: 'Second URL',
        icon: 'WebAsset'
      });
    });

    it('should handle address field with domain', () => {
      const xr = {
        status: {
          address: 'db.internal.example.com'
        }
      };
      const links = callGenerateLinksFromXRStatus(xr);
      expect(links).toContainEqual({
        url: 'https://db.internal.example.com',
        title: 'Service Address',
        icon: 'WebAsset'
      });
    });

    it('should skip address field without domain', () => {
      const xr = {
        status: {
          address: '192-168-1-1'  // No dots, not a domain
        }
      };
      const links = callGenerateLinksFromXRStatus(xr);
      expect(links).toHaveLength(0);
    });

    it('should handle hostname field', () => {
      const xr = {
        status: {
          hostname: 'service.cluster.local'
        }
      };
      const links = callGenerateLinksFromXRStatus(xr);
      expect(links).toContainEqual({
        url: 'https://service.cluster.local',
        title: 'Service Hostname',
        icon: 'WebAsset'
      });
    });

    it('should handle externalURL field', () => {
      const xr = {
        status: {
          externalURL: 'https://monitoring.example.com/dashboard'
        }
      };
      const links = callGenerateLinksFromXRStatus(xr);
      expect(links).toContainEqual({
        url: 'https://monitoring.example.com/dashboard',
        title: 'External URL',
        icon: 'WebAsset'
      });
    });

    it('should extract multiple fields from status', () => {
      const xr = {
        status: {
          domain: 'example.com',
          fqdn: 'service.example.com',
          url: 'https://api.example.com',
          endpoints: ['endpoint1.com'],
          externalURL: 'https://external.example.com'
        }
      };
      const links = callGenerateLinksFromXRStatus(xr);
      expect(links).toHaveLength(5);
      expect(links.map(l => l.title)).toEqual([
        'Service Domain',
        'DNS Query (Google)',
        'Service URL',
        'Endpoint 1',
        'External URL'
      ]);
    });
  });
});