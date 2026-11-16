import { useLayoutEffect, useRef } from 'react'

/** Within this distance of the end, the reader still counts as "following" the list. */
export const NEAR_BOTTOM_PX = 48

/**
 * Keeps a scrollable list on its newest item, like a chat: when `latestKey`
 * changes the list scrolls to the end, unless the reader scrolled up to read
 * history, in which case the view is left where it is. Scrolling back down to
 * the end resumes following.
 *
 * Attach `ref` and `onScroll` to the scrollable element.
 */
export function useStickToBottom<T extends HTMLElement>(latestKey: unknown) {
  const ref = useRef<T>(null)
  const following = useRef(true)

  const onScroll = () => {
    const list = ref.current
    if (!list) return
    following.current = list.scrollHeight - list.scrollTop - list.clientHeight <= NEAR_BOTTOM_PX
  }

  // Layout effect: the list jumps before the new item is painted, so it never flashes out of view.
  useLayoutEffect(() => {
    const list = ref.current
    if (list && following.current) list.scrollTop = list.scrollHeight
  }, [latestKey])

  return { ref, onScroll }
}
