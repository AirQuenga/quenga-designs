export interface ScraperProvider {
  id: string;
  name: string;
  enabled: boolean;
  url: string;
}

export const SCRAPER_PROVIDERS: ScraperProvider[] = [
  { id: 'craigslist', name: 'Craigslist (Butte County)', enabled: true, url: 'https://chico.craigslist.org/search/apa' },
  { id: 'zillow', name: 'Zillow', enabled: false, url: 'https://www.zillow.com/chico-ca/rentals/' },
  { id: 'entwood', name: 'Entwood Property Mgmt', enabled: true, url: 'https://www.entwoodpm.com/vacancies' },
  { id: 'facebook', name: 'FB Marketplace', enabled: false, url: 'https://www.facebook.com/marketplace/chico/rentals' }
];
