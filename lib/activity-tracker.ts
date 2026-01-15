/**
 * Client-side activity tracking utility
 * Tracks page views, link clicks, and button clicks
 */

export type ActivityType = 'PAGE_VIEW' | 'LINK_CLICK' | 'BUTTON_CLICK'

interface TrackActivityParams {
  activityType: ActivityType
  action: string
  resourceType?: string
  resourceId?: string
  url?: string
  metadata?: Record<string, any>
}

/**
 * Track an activity event
 */
async function trackActivity(params: TrackActivityParams): Promise<void> {
  try {
    const response = await fetch('/api/activity/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      console.error('Failed to track activity:', response.statusText)
    }
  } catch (error) {
    // Silently fail - don't interrupt user experience
    console.error('Error tracking activity:', error)
  }
}

/**
 * Track a page view
 */
export function trackPageView(url: string, metadata?: Record<string, any>): void {
  trackActivity({
    activityType: 'PAGE_VIEW',
    action: `View ${url}`,
    url,
    metadata,
  })
}

/**
 * Track a link click
 */
export function trackLinkClick(url: string, text: string, metadata?: Record<string, any>): void {
  trackActivity({
    activityType: 'LINK_CLICK',
    action: `Click: ${text}`,
    url,
    metadata: {
      linkText: text,
      ...metadata,
    },
  })
}

/**
 * Track a button click
 */
export function trackButtonClick(
  action: string,
  metadata?: {
    resourceType?: string
    resourceId?: string
    [key: string]: any
  }
): void {
  trackActivity({
    activityType: 'BUTTON_CLICK',
    action,
    resourceType: metadata?.resourceType,
    resourceId: metadata?.resourceId,
    metadata,
  })
}
