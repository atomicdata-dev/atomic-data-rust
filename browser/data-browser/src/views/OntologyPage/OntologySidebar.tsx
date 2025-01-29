import { core, Resource, useArray, useResource } from '@tomic/react';

import { styled } from 'styled-components';
import { Details } from '../../components/Details';
import { FaAtom, FaCube, FaHashtag } from 'react-icons/fa';
import { ScrollArea } from '../../components/ScrollArea';
import { toAnchorId } from '../../helpers/toAnchorId';

import type { JSX } from 'react';

interface OntologySidebarProps {
  ontology: Resource;
}

export function OntologySidebar({
  ontology,
}: OntologySidebarProps): JSX.Element {
  const [classes] = useArray(ontology, core.properties.classes);
  const [properties] = useArray(ontology, core.properties.properties);
  const [instances] = useArray(ontology, core.properties.instances);

  return (
    <Wrapper>
      <SideBarScrollArea>
        <Details
          initialState={true}
          title={
            <Title>
              <FaCube />
              Classes
            </Title>
          }
        >
          <ul>
            {classes.map(c => (
              <Item key={c} subject={c} />
            ))}
          </ul>
        </Details>
        <Details
          initialState={true}
          title={
            <Title>
              <FaHashtag />
              Properties
            </Title>
          }
        >
          <ul>
            {properties.map(c => (
              <Item key={c} subject={c} />
            ))}
          </ul>
        </Details>
        <Details
          initialState={true}
          title={
            <Title>
              <FaAtom />
              Instances
            </Title>
          }
        >
          <ul>
            {instances.map(c => (
              <Item key={c} subject={c} />
            ))}
          </ul>
        </Details>
      </SideBarScrollArea>
    </Wrapper>
  );
}

interface ItemProps {
  subject: string;
}

function Item({ subject }: ItemProps): JSX.Element {
  const resource = useResource(subject);

  return (
    <StyledLi>
      <ItemLink href={`#${toAnchorId(subject)}`} error={!!resource.error}>
        {resource.title}
      </ItemLink>
    </StyledLi>
  );
}

const Wrapper = styled.div`
  --ontology-sidebar-height: calc(
    100vh - ${p => p.theme.heights.breadCrumbBar}
  );
  position: sticky;
  top: 0px;
  display: flex;
  flex-direction: column;
  background-color: ${p => p.theme.colors.bg};
  height: var(--ontology-sidebar-height);
  border-left: 1px solid ${p => p.theme.colors.bg2};
  min-width: 10rem;
`;

const Title = styled.b`
  display: inline-flex;
  align-items: center;
  gap: 0.8ch;
`;

const StyledLi = styled.li`
  list-style: none;
  margin-left: 0;
  width: 100%;
  margin-bottom: 0;
`;

const ItemLink = styled.a<{ error: boolean }>`
  padding-left: 1rem;
  padding-block: 0.2rem;
  border-radius: ${p => p.theme.radius};
  display: block;
  color: ${p => (p.error ? p.theme.colors.alert : p.theme.colors.textLight)};
  text-decoration: none;
  width: 100%;
  &:hover,
  &:focus-visible {
    color: ${p => p.theme.colors.text};
    background-color: ${p => p.theme.colors.bg1};
  }
  white-space: nowrap;
`;

const SideBarScrollArea = styled(ScrollArea)`
  overflow: hidden;
  padding: ${p => p.theme.size()};
  padding-left: 0.5rem;
  max-height: var(--ontology-sidebar-height);
`;
