import { useRef } from 'react';
import { styled } from 'styled-components';
import { DropdownPortalContext } from './dropdownContext';

export const DropdownContainer: React.FC<React.PropsWithChildren<unknown>> = ({
  children,
}) => {
  const portalRef = useRef<HTMLDivElement>(null);

  return (
    <DropdownPortalContext value={portalRef}>
      {children}
      <DropdownContainerDiv ref={portalRef}></DropdownContainerDiv>
    </DropdownPortalContext>
  );
};

const DropdownContainerDiv = styled.div`
  display: contents;
`;
