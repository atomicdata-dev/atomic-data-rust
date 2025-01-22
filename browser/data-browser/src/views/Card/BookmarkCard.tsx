import { urls, useString } from '@tomic/react';

import { styled } from 'styled-components';
import Markdown from '../../components/datatypes/Markdown';
import {
  ExternalLink,
  ExternalLinkVariant,
} from '../../components/ExternalLink';
import { CardViewProps } from './CardViewProps';
import { ResourceCardTitle } from './ResourceCardTitle';
import { Column } from '../../components/Row';

import type { JSX } from 'react';

export function BookmarkCard({ resource }: CardViewProps): JSX.Element {
  const [url] = useString(resource, urls.properties.bookmark.url);
  const [preview] = useString(resource, urls.properties.bookmark.preview);

  return (
    <Column gap='0.5rem'>
      <ResourceCardTitle resource={resource} />
      <ExternalLink to={url!} variant={ExternalLinkVariant.Button}>
        Open site
      </ExternalLink>
      {preview && (
        <MarkdownWrapper>
          <Markdown maxLength={1000} renderGFM text={preview} />
        </MarkdownWrapper>
      )}
    </Column>
  );
}

const MarkdownWrapper = styled.div`
  margin-top: ${p => p.theme.margin}rem;
  margin-inline: -${p => p.theme.margin}rem;
  padding: ${p => p.theme.margin}rem;
  background-color: ${props => props.theme.colors.bgBody};
  border-top: 1px solid ${props => props.theme.colors.bg2};

  img {
    border-radius: ${props => props.theme.radius};
  }
`;
