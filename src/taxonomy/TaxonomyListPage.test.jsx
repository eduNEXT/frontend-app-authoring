import React from 'react';
import { IntlProvider, injectIntl } from '@edx/frontend-platform/i18n';
import { initializeMockApp } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { AppProvider } from '@edx/frontend-platform/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';

import initializeStore from '../store';
import { apiUrls } from './data/api';
import TaxonomyListPage from './TaxonomyListPage';
import { importTaxonomy } from './import-tags';
import { TaxonomyContext } from './common/context';

let store;
let axiosMock;

const taxonomies = [{
  id: 1,
  name: 'Taxonomy',
  description: 'This is a description',
  showSystemBadge: false,
  canChangeTaxonomy: true,
  canDeleteTaxonomy: true,
  tagsCount: 0,
}];
const organizationsListUrl = 'http://localhost:18010/organizations';
const listTaxonomiesUrl = 'http://localhost:18010/api/content_tagging/v1/taxonomies/?enabled=true';
const listTaxonomiesUnassignedUrl = `${listTaxonomiesUrl}&unassigned=true`;
const listTaxonomiesOrg1Url = `${listTaxonomiesUrl}&org=Org+1`;
const listTaxonomiesOrg2Url = `${listTaxonomiesUrl}&org=Org+2`;
const organizations = ['Org 1', 'Org 2'];

jest.mock('./import-tags', () => ({
  importTaxonomy: jest.fn(),
}));

const context = {
  toastMessage: null,
  setToastMessage: jest.fn(),
};
const queryClient = new QueryClient();

const RootWrapper = () => (
  <AppProvider store={store}>
    <IntlProvider locale="en" messages={{}}>
      <QueryClientProvider client={queryClient}>
        <TaxonomyContext.Provider value={context}>
          <TaxonomyListPage intl={injectIntl} />
        </TaxonomyContext.Provider>
      </QueryClientProvider>
    </IntlProvider>
  </AppProvider>
);

describe('<TaxonomyListPage />', () => {
  beforeEach(async () => {
    initializeMockApp({
      authenticatedUser: {
        userId: 3,
        username: 'abc123',
        administrator: true,
        roles: [],
      },
    });
    store = initializeStore();
    axiosMock = new MockAdapter(getAuthenticatedHttpClient());
    axiosMock.onGet(organizationsListUrl).reply(200, organizations);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render page and page title correctly', () => {
    const { getByText } = render(<RootWrapper />);
    expect(getByText('Taxonomies')).toBeInTheDocument();
  });

  it('shows the spinner before the query is complete', async () => {
    // Simulate an API request that times out:
    axiosMock.onGet(listTaxonomiesUrl).reply(new Promise(() => {}));
    await act(async () => {
      const { findByRole } = render(<RootWrapper />);
      const spinner = await findByRole('status');
      expect(spinner.textContent).toEqual('Loading');
    });
  });

  it('shows the data table after the query is complete', async () => {
    axiosMock.onGet(listTaxonomiesUrl).reply(200, { results: taxonomies, canAddTaxonomy: false });
    await act(async () => {
      const { findByTestId, queryByText } = render(<RootWrapper />);
      await waitFor(() => { expect(queryByText('Loading')).toEqual(null); });
      expect(await findByTestId('taxonomy-card-1')).toBeInTheDocument();
    });
  });

  it.each(['CSV', 'JSON'])('downloads the taxonomy template %s', async (fileFormat) => {
    axiosMock.onGet(listTaxonomiesUrl).reply(200, { results: taxonomies, canAddTaxonomy: false });
    const { findByRole, queryByText } = render(<RootWrapper />);
    // Wait until data has been loaded and rendered:
    await waitFor(() => { expect(queryByText('Loading')).toEqual(null); });
    const templateMenu = await findByRole('button', { name: 'Download template' });
    fireEvent.click(templateMenu);
    const templateButton = await findByRole('link', { name: `${fileFormat} template` });
    fireEvent.click(templateButton);

    expect(templateButton.href).toBe(apiUrls.taxonomyTemplate(fileFormat.toLowerCase()));
  });

  it('disables the import taxonomy button if not permitted', async () => {
    axiosMock.onGet(listTaxonomiesUrl).reply(200, { results: [], canAddTaxonomy: false });

    const { queryByText, getByRole } = render(<RootWrapper />);
    // Wait until data has been loaded and rendered:
    await waitFor(() => { expect(queryByText('Loading')).toEqual(null); });
    const importButton = getByRole('button', { name: 'Import' });
    expect(importButton).toBeDisabled();
  });

  it('calls the import taxonomy action when the import button is clicked', async () => {
    axiosMock.onGet(listTaxonomiesUrl).reply(200, { results: [], canAddTaxonomy: true });

    const { getByRole } = render(<RootWrapper />);
    const importButton = getByRole('button', { name: 'Import' });
    // Once the API response is received and rendered, the Import button should be enabled:
    await waitFor(() => { expect(importButton).not.toBeDisabled(); });
    fireEvent.click(importButton);
    expect(importTaxonomy).toHaveBeenCalled();
  });

  it('should show all "All taxonomies", "Unassigned" and org names in taxonomy org filter', async () => {
    axiosMock.onGet(listTaxonomiesUrl).reply(200, {
      results: [{
        id: 1,
        name: 'Taxonomy',
        description: 'This is a description',
        showSystemBadge: false,
        canChangeTaxonomy: false,
        canDeleteTaxonomy: false,
        tagsCount: 0,
      }],
      canAddTaxonomy: false,
    });

    const {
      getByTestId,
      getByText,
      getByRole,
      getAllByText,
      queryByText,
    } = render(<RootWrapper />);
    // Wait until data has been loaded and rendered:
    await waitFor(() => { expect(queryByText('Loading')).toEqual(null); });

    expect(getByTestId('taxonomy-orgs-filter-selector')).toBeInTheDocument();
    // Check that the default filter is set to 'All taxonomies' when page is loaded
    expect(getByText('All taxonomies')).toBeInTheDocument();

    // Open the taxonomies org filter select menu
    fireEvent.click(getByRole('button', { name: 'All taxonomies' }));

    // Check that the select menu shows 'All taxonomies' option
    // along with the default selected one
    expect(getAllByText('All taxonomies').length).toBe(2);
    // Check that the select manu shows 'Unassigned' option
    expect(getByText('Unassigned')).toBeInTheDocument();
    // Check that the select menu shows the 'Org 1' option
    expect(getByText('Org 1')).toBeInTheDocument();
    // Check that the select menu shows the 'Org 2' option
    expect(getByText('Org 2')).toBeInTheDocument();
  });

  it('should fetch taxonomies with correct params for org filters', async () => {
    axiosMock.onGet(listTaxonomiesUrl).reply(200, { results: taxonomies, canAddTaxonomy: false });
    const defaults = {
      id: 1,
      showSystemBadge: false,
      canChangeTaxonomy: true,
      canDeleteTaxonomy: true,
      tagsCount: 0,
      description: 'Taxonomy description here',
    };
    axiosMock.onGet(listTaxonomiesUnassignedUrl).reply(200, {
      canAddTaxonomy: false,
      results: [{ name: 'Unassigned Taxonomy A', ...defaults }],
    });
    axiosMock.onGet(listTaxonomiesOrg1Url).reply(200, {
      canAddTaxonomy: false,
      results: [{ name: 'Org1 Taxonomy B', ...defaults }],
    });
    axiosMock.onGet(listTaxonomiesOrg2Url).reply(200, {
      canAddTaxonomy: false,
      results: [{ name: 'Org2 Taxonomy C', ...defaults }],
    });

    const { getByRole, getByText, queryByText } = render(<RootWrapper />);

    // Open the taxonomies org filter select menu
    const taxonomiesFilterSelectMenu = await getByRole('button', { name: 'All taxonomies' });
    fireEvent.click(taxonomiesFilterSelectMenu);

    // Check that the 'Unassigned' option is correctly called
    fireEvent.click(getByRole('link', { name: 'Unassigned' }));
    await waitFor(() => {
      expect(getByText('Unassigned Taxonomy A')).toBeInTheDocument();
    });

    // Open the taxonomies org filter select menu again
    fireEvent.click(taxonomiesFilterSelectMenu);

    // Check that the 'Org 1' option is correctly called
    fireEvent.click(getByRole('link', { name: 'Org 1' }));
    await waitFor(() => {
      expect(getByText('Org1 Taxonomy B')).toBeInTheDocument();
    });

    // Open the taxonomies org filter select menu again
    fireEvent.click(taxonomiesFilterSelectMenu);

    // Check that the 'Org 2' option is correctly called
    fireEvent.click(getByRole('link', { name: 'Org 2' }));
    await waitFor(() => {
      expect(queryByText('Org1 Taxonomy B')).not.toBeInTheDocument();
      expect(queryByText('Org2 Taxonomy C')).toBeInTheDocument();
    });

    // Open the taxonomies org filter select menu again
    fireEvent.click(taxonomiesFilterSelectMenu);

    // Check that the 'All' option is correctly called, it should show as
    // 'All' rather than 'All taxonomies' in the select menu since its not selected
    fireEvent.click(getByRole('link', { name: 'All' }));
    await waitFor(() => {
      expect(getByText(taxonomies[0].description)).toBeInTheDocument();
    });
  });
});
