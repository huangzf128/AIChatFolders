import { LayoutStyles } from './layout';
import { FolderStyles } from './folder';
import { ComponentStyles } from './components';
import { CollapseStyles } from './collapse';

/**
 * Combined Global Styles
 */
export const GlobalStyles = `
    ${LayoutStyles}
    ${FolderStyles}
    ${ComponentStyles}
    ${CollapseStyles}
`;