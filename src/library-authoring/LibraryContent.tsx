import { useEffect } from 'react';
import { LoadingSpinner } from '../generic/Loading';
import { useSearchContext } from '../search-manager';
import { NoComponents, NoSearchResults } from './EmptyStates';
import { useLibraryContext } from './common/context/LibraryContext';
import { useSidebarContext } from './common/context/SidebarContext';
import CollectionCard from './components/CollectionCard';
import ComponentCard from './components/ComponentCard';
import ContainerCard from './components/ContainerCard';
import { ContentType } from './routes';
import { useLoadOnScroll } from '../hooks';
import messages from './collections/messages';

/**
 * Library Content to show content grid
 *
 * Use content to:
 *   - 'collections': Suggest to create a collection on empty state.
*   - Anything else to suggest to add content on empty state.
 */

type LibraryContentProps = {
  contentType?: ContentType;
};

const LibraryItemCard = {
  collection: CollectionCard,
  library_block: ComponentCard,
  library_container: ContainerCard,
};

const LibraryContent = ({ contentType = ContentType.home }: LibraryContentProps) => {
  const {
    hits,
    totalHits,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isLoading,
    isFiltered,
    usageKey,
  } = useSearchContext();
  const { openCreateCollectionModal } = useLibraryContext();
  const { openAddContentSidebar, openComponentInfoSidebar } = useSidebarContext();

  /**
   * Filter collections on the frontend to display only collection cards in the Collections tab.
   * This approach is used instead of backend filtering to ensure that all components (including those
   * within collections) remain available in the 'hits' array. This is necessary for the component
   * selection workflow when adding components to xblocks by choosing the while collection in Collections tab.
   * Note: LibraryAuthoringPage.tsx has been modified to skip backend filtering for this purpose.
   */
  const filteredHits = contentType === ContentType.collections
    ? hits.filter((hit) => hit.type === 'collection')
    : hits;

  useEffect(() => {
    if (usageKey) {
      openComponentInfoSidebar(usageKey);
    }
  }, [usageKey]);

  useLoadOnScroll(
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    true,
  );

  if (isLoading) {
    return <LoadingSpinner />;
  }
  if (totalHits === 0) {
    if (contentType === ContentType.collections) {
      return isFiltered
        ? <NoSearchResults infoText={messages.noSearchResultsCollections} />
        : (
          <NoComponents
            infoText={messages.noCollections}
            addBtnText={messages.addCollection}
            handleBtnClick={openCreateCollectionModal}
          />
        );
    }
    return isFiltered ? <NoSearchResults /> : <NoComponents handleBtnClick={openAddContentSidebar} />;
  }

  return (
    <div className="library-cards-grid">
      {filteredHits.map((contentHit) => {
        const CardComponent = LibraryItemCard[contentHit.type] || ComponentCard;

        return <CardComponent key={contentHit.id} hit={contentHit} />;
      })}
    </div>
  );
};

export default LibraryContent;
