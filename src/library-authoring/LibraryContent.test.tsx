import fetchMock from 'fetch-mock-jest';

import { getContentSearchConfigUrl } from '@src/search-manager/data/api';
import {
  act,
  render,
  screen,
  initializeMocks,
} from '@src/testUtils';

import { mockContentLibrary } from './data/api.mocks';
import mockEmptyResult from '../search-modal/__mocks__/empty-search-result.json';
import { LibraryProvider } from './common/context/LibraryContext';
import LibraryContent from './LibraryContent';
import { libraryComponentsMock } from './__mocks__';

const searchEndpoint = 'http://mock.meilisearch.local/multi-search';

mockContentLibrary.applyMock();
const mockFetchNextPage = jest.fn();
const mockUseSearchContext = jest.fn();

const data = {
  totalContentAndCollectionHits: 0,
  contentAndCollectionHits: [],
  isFetchingNextPage: false,
  hasNextPage: false,
  fetchNextPage: mockFetchNextPage,
  searchKeywords: '',
  isFiltered: false,
  isPending: false,
};

const returnEmptyResult = (_url: string, req) => {
  const requestData = JSON.parse(req.body?.toString() ?? '');
  const query = requestData?.queries[0]?.q ?? '';
  // We have to replace the query (search keywords) in the mock results with the actual query,
  // because otherwise we may have an inconsistent state that causes more queries and unexpected results.
  mockEmptyResult.results[0].query = query;
  // And fake the required '_formatted' fields; it contains the highlighting <mark>...</mark> around matched words
  // eslint-disable-next-line no-underscore-dangle, no-param-reassign
  mockEmptyResult.results[0]?.hits.forEach((hit: any) => { hit._formatted = { ...hit }; });
  return mockEmptyResult;
};

jest.mock('../search-manager', () => ({
  ...jest.requireActual('../search-manager'),
  useSearchContext: () => mockUseSearchContext(),
}));

const withLibraryId = (libraryId: string) => ({
  extraWrapper: ({ children }: { children: React.ReactNode }) => (
    <LibraryProvider libraryId={libraryId}>
      {children}
    </LibraryProvider>
  ),
});

describe('<LibraryHome />', () => {
  beforeEach(() => {
    const { axiosMock } = initializeMocks();

    fetchMock.post(searchEndpoint, returnEmptyResult, { overwriteRoutes: true });

    // The API method to get the Meilisearch connection details uses Axios:
    axiosMock.onGet(getContentSearchConfigUrl()).reply(200, {
      url: 'http://mock.meilisearch.local',
      index_name: 'studio',
      api_key: 'test-key',
    });
  });

  afterEach(() => {
    fetchMock.reset();
    mockFetchNextPage.mockReset();
  });

  it('should render a spinner while loading', async () => {
    mockUseSearchContext.mockReturnValue({
      ...data,
      isPending: true,
    });

    render(<LibraryContent />, withLibraryId(mockContentLibrary.libraryId));
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render an empty state when there are no results', async () => {
    mockUseSearchContext.mockReturnValue({
      ...data,
      totalHits: 0,
    });
    render(<LibraryContent />, withLibraryId(mockContentLibrary.libraryId));
    expect(screen.getByText('You have not added any content to this library yet.')).toBeInTheDocument();
  });

  describe('infinite scroll', () => {
    let observerCallback: IntersectionObserverCallback;
    let observedElement: Element | undefined;
    let originalIntersectionObserver: typeof IntersectionObserver;

    const setSentinelVisible = (isIntersecting: boolean) => {
      act(() => {
        observerCallback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
      });
    };

    beforeEach(() => {
      observedElement = undefined;
      originalIntersectionObserver = global.IntersectionObserver;
      global.IntersectionObserver = jest.fn((callback: IntersectionObserverCallback) => {
        observerCallback = callback;
        return {
          observe: (element: Element) => { observedElement = element; },
          disconnect: jest.fn(),
        };
      }) as unknown as typeof IntersectionObserver;
    });

    afterEach(() => {
      global.IntersectionObserver = originalIntersectionObserver;
    });

    it('should load more results when the end of the list becomes visible', async () => {
      mockUseSearchContext.mockReturnValue({
        ...data,
        hits: libraryComponentsMock,
        hasNextPage: true,
      });
      const { container } = render(<LibraryContent />, withLibraryId(mockContentLibrary.libraryId));

      // The observed sentinel is rendered right after the cards grid.
      const grid = container.querySelector('.library-cards-grid');
      expect(observedElement).toBeDefined();
      expect(grid?.nextElementSibling).toBe(observedElement);

      setSentinelVisible(false);
      expect(mockFetchNextPage).not.toHaveBeenCalled();

      setSentinelVisible(true);
      expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
    });

    it('should not observe the end of the list when there are no more results', async () => {
      mockUseSearchContext.mockReturnValue({
        ...data,
        hits: libraryComponentsMock,
        hasNextPage: false,
      });
      render(<LibraryContent />, withLibraryId(mockContentLibrary.libraryId));

      expect(observedElement).toBeUndefined();
    });
  });
});
