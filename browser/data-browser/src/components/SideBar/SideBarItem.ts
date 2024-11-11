import { styled } from 'styled-components';
import { transition } from '../../helpers/transition';

export interface SideBarItemProps {
  disabled?: boolean;
}

/** SideBarItem should probably be wrapped in an AtomicLink for optimal behavior */
// eslint-disable-next-line prettier/prettier
export const SideBarItem = styled('span')<SideBarItemProps>`
  display: flex;
  min-height: ${props => props.theme.margin * 0.5 + 1}rem;
  align-items: center;
  justify-content: flex-start;
  color: ${p => (p.disabled ? p.theme.colors.main : p.theme.colors.textLight)};
  padding: 0.2rem;
  padding-left: 0.5rem;
  text-overflow: ellipsis;
  text-decoration: none;
  border-radius: ${p => p.theme.radius};

  &:hover,
  &:focus {
    background-color: ${p => p.theme.colors.bg1};
    color: ${p => (p.disabled ? p.theme.colors.main : p.theme.colors.text)};
  }
  &:active {
    // filter: brightness(0.95);
    background-color: ${p => p.theme.colors.bg2};
    // opacity: 0.5;
  }

  svg {
    font-size: 0.8rem;
  }
`;
