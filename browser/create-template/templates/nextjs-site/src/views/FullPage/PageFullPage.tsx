import type { Resource } from '@tomic/lib';
import BlockView from '../Block/BlockView';
import { type Page } from '@/ontologies/website';
import styles from './PageFullPage.module.css';
import Container from '@/components/Layout/Container';

const PageFullPage = ({ resource }: { resource: Resource<Page> }) => {
  const title = resource.title;

  return (
    <Container>
      <div className={styles.wrapper}>
        <h1>{title?.toString()}</h1>

        {resource.props.blocks?.map(block => (
          <BlockView key={block} subject={block} />
        ))}
      </div>
    </Container>
  );
};

export default PageFullPage;
