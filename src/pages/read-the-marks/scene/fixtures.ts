/**
 * What stands at the lines' ends, in neutral grays as many are: the transformer box, the
 * communication pedestal, the two meter boxes in the grass strip, the sewer cleanout's cap, and the
 * meters and the cable box on the house. None wears a mark color, not even the reclaimed water
 * box, whose lid is often purple in the field: here only the marks may.
 */
import { CylinderGeometry, Group, Mesh, type BufferGeometry, type Material } from 'three';
import { roundedBox } from '../../../kit3d/geometry.ts';
import { surface } from '../../../kit3d/materials.ts';
import { FIXTURES as F, TOPS } from './layout.ts';
import { YARD_COLORS as Y } from './palette.ts';

function mesh(geometry: BufferGeometry, material: Material): Mesh {
  const m = new Mesh(geometry, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildFixtures(): Group {
  const group = new Group();
  group.name = 'fixtures';
  const gray = surface(Y.fixture, { finish: 'paint' });
  const light = surface(Y.fixtureLight, { finish: 'paint' });
  const concrete = surface(Y.concrete, { noise: { scale: 3, amount: 0.06 } });
  const cap = surface(Y.cap, { finish: 'paint' });
  const g = TOPS.grass;
  group.add(
    mesh(roundedBox(3.2, 2.6, 3.0, 0.2, [F.transformer.x, g + 1.3, F.transformer.z]), gray),
    mesh(roundedBox(1.1, 2.9, 0.9, 0.12, [F.pedestal.x, g + 1.45, F.pedestal.z]), light),
    mesh(roundedBox(1.7, 0.16, 1.1, 0.05, [F.waterBox.x, g + 0.03, F.waterBox.z]), concrete),
    mesh(
      roundedBox(1.7, 0.16, 1.1, 0.05, [F.reclaimedBox.x, g + 0.03, F.reclaimedBox.z]),
      concrete,
    ),
    mesh(
      new CylinderGeometry(0.3, 0.3, 0.12, 24).translate(F.cleanout.x, g + 0.06, F.cleanout.z),
      cap,
    ),
    mesh(roundedBox(1.2, 1.5, 0.7, 0.1, [F.gasMeter.x, 2.2, F.gasMeter.z + 0.4]), gray),
    mesh(
      new CylinderGeometry(0.12, 0.12, 1.5, 12).translate(F.gasMeter.x, 0.75, F.gasMeter.z + 0.5),
      gray,
    ),
    mesh(roundedBox(0.9, 1.3, 0.5, 0.1, [F.electricMeter.x, 4.4, F.electricMeter.z + 0.3]), gray),
    mesh(roundedBox(0.8, 1.0, 0.4, 0.08, [F.terminal.x, 2.4, F.terminal.z + 0.25]), light),
  );
  return group;
}
