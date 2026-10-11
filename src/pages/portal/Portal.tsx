/**
 * The portal: the site's home. Three sections, each with its lessons as cards; a section still
 * being built says it's coming soon. Each card is one link, named by its title.
 */
import { BRAND } from '../../../config/brand.ts';
import { SECTIONS, type Lesson, type Section } from '../../../content/portal.ts';
import { Icon } from '../../design/icons.tsx';
import frequencyLab from './images/frequency-lab.jpg';
import gasPetroleum from './images/gas-petroleum.jpg';

const IMAGES: Record<Lesson['image'], string> = {
  'frequency-lab': frequencyLab,
  'gas-petroleum': gasPetroleum,
};

/** Lesson links are relative to the site root, which is where the portal lives. */
const BASE = import.meta.env.BASE_URL;

function LessonCard({ lesson }: { lesson: Lesson }) {
  return (
    <li class="lesson">
      <img
        class="lesson-image"
        src={IMAGES[lesson.image]}
        alt=""
        width="960"
        height="540"
        decoding="async"
      />
      <div class="lesson-text">
        <h3>
          {/* The link covers the whole card, so anywhere on it opens the lesson. */}
          <a class="lesson-link" href={`${BASE}${lesson.href}`}>
            {lesson.title}
          </a>
        </h3>
        <p>{lesson.summary}</p>
        <span class="lesson-go" aria-hidden="true">
          Open
          <Icon name="forward" />
        </span>
      </div>
    </li>
  );
}

function ComingSoon({ section }: { section: Section }) {
  return (
    <li class="lesson lesson-soon">
      <div class="lesson-image soon-art" aria-hidden="true">
        <Icon name={section.icon} />
      </div>
      <div class="lesson-text">
        <p class="soon-label">Coming soon</p>
      </div>
    </li>
  );
}

export function Portal() {
  return (
    <div class="portal">
      <header class="portal-head">
        <h1>{BRAND.name}</h1>
        <p>{BRAND.tagline}</p>
      </header>
      <main class="portal-sections">
        {SECTIONS.map((section) => (
          <section key={section.id} class="portal-section" aria-labelledby={`${section.id}-title`}>
            <div class="section-head">
              <span class="section-icon" aria-hidden="true">
                <Icon name={section.icon} />
              </span>
              <h2 id={`${section.id}-title`}>{section.title}</h2>
            </div>
            <p class="section-summary">{section.summary}</p>
            <ul class="lessons" aria-label={`${section.title} lessons`}>
              {section.lessons.length > 0 ? (
                section.lessons.map((lesson) => <LessonCard key={lesson.href} lesson={lesson} />)
              ) : (
                <ComingSoon section={section} />
              )}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
