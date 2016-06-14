const DRAG_SLOP = 4; // pixels


export class DragHelper {
  constructor(opts) {
    opts = opts || {};

    this.direction_ = opts.direction || 'both';
    this.downX_ = opts.downEvent.clientX;
    this.downY_ = opts.downEvent.clientY;
    this.skipSlopCheck_ = !!opts.skipSlopCheck;

    this.onBeginDrag_ = opts.onBeginDrag || (() => {});
    this.onDrag_ = opts.onDrag || (() => {});
    this.onDrop_ = opts.onDrop || (() => {});

    this.dragging_ = false;
    this.draggingScrim_ = null;

    this.draggingCursor = opts.draggingCursor || 'grabbing';

    let mouseMoveHandler_ = event => {
      if (!this.dragging_ && this.shouldBeginDragging_(event)) {
        this.dragging_ = true;
        this.draggingScrim_ = this.buildDraggingScrim_().appendTo(document.body);
        this.draggingCursor = this.draggingCursor_;
        this.onBeginDrag_(event);
      }

      if (this.dragging_) {
        this.onDrag_(event, {
          x: event.clientX - this.downX_,
          y: event.clientY - this.downY_
        });
      }
    };

    let mouseUpHandler_ = event => {
      $(window)
          .off('mousemove', mouseMoveHandler_)
          .off('mouseup', mouseUpHandler_);
      if (this.dragging_) {
        this.onDrag_(event, {
          x: event.clientX - this.downX_,
          y: event.clientY - this.downY_
        });

        this.onDrop_();

        this.draggingScrim_.remove();
        this.draggingScrim_ = null;
        this.dragging_ = false;

        event.stopPropagation();
        event.preventDefault();
        return false;
      }
    };

    $(window)
        .on('mousemove', mouseMoveHandler_)
        .on('mouseup', mouseUpHandler_);
  }

  shouldBeginDragging_(mouseMoveEvent) {
    if (this.skipSlopCheck_) {
      return true;
    }

    let begin = false;
    if (this.direction_ == 'both' || this.direction_ == 'horizontal') {
      begin = begin || (Math.abs(mouseMoveEvent.clientX - this.downX_) > DRAG_SLOP);
    }
    if (this.direction_ == 'both' || this.direction_ == 'vertical') {
      begin = begin || (Math.abs(mouseMoveEvent.clientY - this.downY_) > DRAG_SLOP);
    }
    return begin;
  }

  set draggingCursor(cursor) {
    if (cursor == 'grabbing') {
      cursor = `-webkit-${cursor}`;
    }

    this.draggingCursor_ = cursor;
    if (this.draggingScrim_) {
      this.draggingScrim_.css({cursor});
    }
  }

  buildDraggingScrim_() {
    return $('<div>')
        .css({
          position: 'fixed',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999
        });
  }

}
