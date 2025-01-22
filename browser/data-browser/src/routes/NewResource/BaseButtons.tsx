import { core, dataBrowser } from '@tomic/react';
import { OutlinedSection } from '../../components/OutlinedSection';
import { ClassButton } from './ClassButton';

import type { JSX } from 'react';

interface BaseButtonsProps {
  parent: string;
}

const buttons = [
  dataBrowser.classes.table,
  dataBrowser.classes.folder,
  dataBrowser.classes.document,
  dataBrowser.classes.chatroom,
  dataBrowser.classes.bookmark,
  core.classes.ontology,
];

export function BaseButtons({ parent }: BaseButtonsProps): JSX.Element {
  return (
    <OutlinedSection title='Base classes'>
      {buttons.map(classType => (
        <ClassButton key={classType} classType={classType} parent={parent} />
      ))}
    </OutlinedSection>
  );
}
