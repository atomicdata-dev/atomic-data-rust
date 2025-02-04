import { Blogpost } from '@/ontologies/website';
import { Resource } from '@tomic/react';
import { Image } from '@/components/Image';
import styles from './BlogListItem.module.css';

const BlogListItem = async ({ resource }: { resource: Resource<Blogpost> }) => {
  const formatter = new Intl.DateTimeFormat('default', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const date = resource.props.publishedAt
    ? formatter.format(new Date(resource.props.publishedAt))
    : '';

  return (
    <a className={styles.card} href={resource.props.href ?? '#'}>
      <div className={styles.imageWrapper}>
        <Image subject={resource.props.coverImage} alt='' />
      </div>
      <div className={styles.cardContent}>
        <div className={styles.publishDate}>{date}</div>
        <h2 className={styles.h2}>{resource.title}</h2>
        <p className={styles.p}>
          {resource.props.description?.slice(0, 300)}...
        </p>
      </div>
    </a>
  );
};

export default BlogListItem;
