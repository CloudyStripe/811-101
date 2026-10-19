/**
 * The 3D loader, once a page's code has taken over from its static shell: the same markup as the
 * shell's (src/site/shell.ts), its style the shell's own (tiny copies of its posters and all, kept
 * as the shell went), kept until the view draws, or put away at once if it can't.
 */
import { BASE_PATH } from '../../config/brand.ts';
import { lessonTransition, type PageInfo } from './pages.ts';
import { posterStyle, shellLoaderStyle } from './loader.ts';

export function SceneLoader({ page, done }: { page: PageInfo; done: boolean }) {
  return (
    <div
      class="scene-loader"
      aria-hidden="true"
      data-done={done ? '' : undefined}
      style={shellLoaderStyle() ?? posterStyle(page, BASE_PATH)}
    >
      <div
        class="scene-loader-poster"
        style={{ '--lesson-transition': lessonTransition(page.id) }}
      />
      <div class="scene-loader-status">
        <span class="scene-loader-bar">
          <span />
        </span>
        <span class="scene-loader-text">Loading the 3D view</span>
      </div>
    </div>
  );
}
