// @flow
import { add, subtract } from '../position';
import {
  canScrollDroppable,
  canScrollWindow,
  getWindowOverlap,
  getDroppableOverlap,
} from './can-scroll';
import type {
  DraggableId,
  DroppableId,
  DragState,
  DroppableDimension,
  Position,
  State,
  DraggableLocation,
  Viewport,
} from '../../types';

type Args = {|
  scrollDroppable: (id: DroppableId, offset: Position) => void,
  scrollWindow: (offset: Position) => void,
  move: (
    id: DraggableId,
    client: Position,
    viewport: Viewport,
    shouldAnimate?: boolean
  ) => void,
|}

export type JumpScroller = (state: State) => void;

type Remainder = Position;

export default ({
  move,
  scrollDroppable,
  scrollWindow,
}: Args): JumpScroller => {
  const moveByOffset = (state: State, offset: Position) => {
    const drag: ?DragState = state.drag;
    if (!drag) {
      console.error('Cannot move by offset when not dragging');
      return;
    }

    const client: Position = add(drag.current.client.selection, offset);
    move(drag.initial.descriptor.id, client, drag.current.viewport, true);
  };

  const scrollDroppableAsMuchAsItCan = (
    droppable: DroppableDimension,
    change: Position
  ): ?Remainder => {
    // Droppable cannot absorb any of the scroll
    if (!canScrollDroppable(droppable, change)) {
      return change;
    }

    const overlap: ?Position = getDroppableOverlap(droppable, change);

    // Droppable can absorb the entire change
    if (!overlap) {
      scrollDroppable(droppable.descriptor.id, change);
      return null;
    }

    // Droppable can only absorb a part of the change
    const whatTheDroppableCanScroll: Position = subtract(change, overlap);
    scrollDroppable(droppable.descriptor.id, whatTheDroppableCanScroll);

    const remainder: Position = subtract(change, whatTheDroppableCanScroll);
    return remainder;
  };

  const scrollWindowAsMuchAsItCan = (viewport: Viewport, change: Position): ?Position => {
    // window cannot absorb any of the scroll
    if (!canScrollWindow(viewport, change)) {
      return change;
    }

    const overlap: ?Position = getWindowOverlap(viewport, change);

    // window can absorb entire scroll
    if (!overlap) {
      scrollWindow(change);
      return null;
    }

    // window can only absorb a part of the scroll
    const whatTheWindowCanScroll: Position = subtract(change, overlap);
    scrollWindow(whatTheWindowCanScroll);

    const remainder: Position = subtract(change, whatTheWindowCanScroll);
    return remainder;
  };

  const jumpScroller: JumpScroller = (state: State) => {
    const drag: ?DragState = state.drag;

    if (!drag) {
      return;
    }

    const request: ?Position = drag.scrollJumpRequest;

    if (!request) {
      return;
    }

    const destination: ?DraggableLocation = drag.impact.destination;

    if (!destination) {
      console.error('Cannot perform a jump scroll when there is no destination');
      return;
    }

    // 1. We scroll the droppable first if we can to avoid the draggable
    // leaving the list

    const droppableRemainder: ?Position = scrollDroppableAsMuchAsItCan(
      state.dimension.droppable[destination.droppableId],
      request,
    );

    // droppable absorbed the entire scroll
    if (!droppableRemainder) {
      return;
    }

    const viewport: Viewport = drag.current.viewport;
    const windowRemainder: ?Position = scrollWindowAsMuchAsItCan(viewport, droppableRemainder);

    // window could absorb all the droppable remainder
    if (!windowRemainder) {
      return;
    }

    // The entire scroll could not be absorbed by the droppable and window
    // so we manually move whatever is left
    moveByOffset(state, windowRemainder);
  };

  return jumpScroller;
};
