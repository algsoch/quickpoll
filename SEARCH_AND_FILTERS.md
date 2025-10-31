# Search & Advanced Filters Feature 🔍

**Version:** 22  
**Date:** 2024  
**Status:** ✅ Completed

## Overview

The Search & Advanced Filters feature provides users with powerful tools to find and organize polls based on various criteria. This feature includes real-time search with debouncing, multiple sorting options, and date range filtering.

## Features Implemented

### 1. **Search Functionality** 🔍
- Real-time search by poll title or description
- Debounced input (300ms delay) to reduce API calls
- Case-insensitive search
- Placeholder with emoji for better UX

### 2. **Sort Options** 📊
Four sorting modes available:
- **Newest First** (default): Most recently created polls appear first
- **Oldest First**: Earliest created polls appear first  
- **Most Voted**: Polls with the highest number of votes appear first
- **Most Liked**: Polls with the most likes appear first

### 3. **Date Range Filtering** 📅
- **From Date**: Filter polls created on or after a specific date
- **To Date**: Filter polls created on or before a specific date
- Date inputs with native date picker support
- Inclusive date range (includes both start and end dates)

### 4. **Clear Filters** 🔄
- One-click button to reset all filters
- Clears search, sort selection, and date ranges
- Shows success toast notification
- Maintains current filter tab (All/Active/Closed/My Polls)

## Technical Implementation

### Frontend (app.js v22)

#### New Functions
```javascript
// Helper to get current search parameters
getCurrentSearchParams()
```

#### Updated Functions
```javascript
// Modified to accept search parameters
loadPolls(filter = 'all', searchParams = {})
```

#### Event Listeners
- **Search Input**: Debounced with 300ms delay
- **Sort Select**: Immediate filter on change
- **Date Inputs**: Immediate filter on change
- **Clear Filters**: Reset all inputs and reload

### Frontend (index.html)

#### New HTML Structure
```html
<div class="search-filter-bar">
    <div class="search-wrapper">
        <input type="text" id="searchInput" placeholder="🔍 Search polls...">
    </div>
    <div class="advanced-filters">
        <select id="sortSelect">...</select>
        <input type="date" id="dateFrom">
        <input type="date" id="dateTo">
        <button id="clearFilters">🔄 Clear</button>
    </div>
</div>
```

### Frontend (styles.css v13)

#### New CSS Classes
- `.search-filter-bar`: Container for all search/filter controls
- `.search-wrapper`: Wraps the search input
- `.search-input`: Styled text input with focus states
- `.advanced-filters`: Flexbox container for filters
- `.sort-select`, `.date-input`: Styled form controls
- `.clear-filters-btn`: Reset button styling

#### Responsive Design
Mobile-optimized at 768px breakpoint:
- Full-width search bar
- Flexible filter controls
- Stacked layout on small screens
- Touch-friendly tap targets

### Backend (routers/polls.py)

#### Updated Endpoint
```python
@router.get("/", response_model=List[PollListResponse])
async def list_polls(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    active_only: bool = Query(True),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("newest"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
)
```

#### Query Parameters
- `search`: Search pattern for title/description (case-insensitive)
- `sort_by`: One of `newest`, `oldest`, `most-voted`, `most-liked`
- `date_from`: ISO date string (YYYY-MM-DD)
- `date_to`: ISO date string (YYYY-MM-DD)

#### Database Queries

**Search Filter:**
```python
if search:
    search_pattern = f"%{search}%"
    query = query.where(
        or_(
            Poll.title.ilike(search_pattern),
            Poll.description.ilike(search_pattern)
        )
    )
```

**Sort by Votes:**
```python
vote_counts = (
    select(Vote.poll_id, func.count(Vote.id).label("vote_count"))
    .group_by(Vote.poll_id)
    .subquery()
)
query = query.outerjoin(vote_counts, Poll.id == vote_counts.c.poll_id)
query = query.order_by(func.coalesce(vote_counts.c.vote_count, 0).desc())
```

**Sort by Likes:**
```python
like_counts = (
    select(Like.poll_id, func.count(Like.id).label("like_count"))
    .group_by(Like.poll_id)
    .subquery()
)
query = query.outerjoin(like_counts, Poll.id == like_counts.c.poll_id)
query = query.order_by(func.coalesce(like_counts.c.like_count, 0).desc())
```

**Date Range:**
```python
if date_from:
    date_from_obj = datetime.strptime(date_from, "%Y-%m-%d")
    query = query.where(Poll.created_at >= date_from_obj)

if date_to:
    date_to_obj = datetime.strptime(date_to, "%Y-%m-%d")
    date_to_obj = date_to_obj + timedelta(days=1)  # Include entire end date
    query = query.where(Poll.created_at < date_to_obj)
```

## User Experience

### Empty States
Context-aware messages when no polls match filters:
- **With search**: "No polls found matching '[query]'. Try a different search term."
- **My Polls**: "You haven't created any polls yet. Click 'Create Poll' to get started!"
- **Active**: "No active polls found. Check the 'Closed' tab for completed polls."
- **Closed**: "No closed polls found. Active polls will appear here once they are closed."

### Loading States
- Skeleton screens shown during search/filter operations
- Smooth transitions between filter changes
- No jarring layout shifts

### Success Feedback
- Toast notification when filters are cleared
- Visual feedback on search input focus
- Active state highlighting on filter buttons

## Performance Optimizations

1. **Debouncing**: 300ms delay prevents excessive API calls during typing
2. **Backend Indexing**: Database queries optimized with proper indexes
3. **Efficient Queries**: Subqueries and joins minimize database round-trips
4. **Lazy Loading**: Only fetches polls matching current filters

## Browser Compatibility

- ✅ Chrome/Edge (90+)
- ✅ Firefox (88+)
- ✅ Safari (14+)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Accessibility

- Keyboard navigation support
- Clear focus indicators
- Descriptive placeholders
- ARIA labels for screen readers
- Touch-friendly controls (44px minimum)

## Testing Checklist

- [x] Search by title works
- [x] Search by description works
- [x] Search is case-insensitive
- [x] Debouncing prevents rapid API calls
- [x] Sort by newest works
- [x] Sort by oldest works
- [x] Sort by most voted works
- [x] Sort by most liked works
- [x] Date from filter works
- [x] Date to filter works
- [x] Date range combination works
- [x] Clear filters resets all inputs
- [x] Clear filters shows toast
- [x] Filters work with All tab
- [x] Filters work with Active tab
- [x] Filters work with Closed tab
- [x] Filters work with My Polls tab
- [x] Empty states show correct messages
- [x] Mobile responsive layout
- [x] Touch controls work on mobile

## Files Modified

### Frontend
1. **frontend/index.html**
   - Added search input
   - Added sort dropdown
   - Added date range inputs
   - Added clear filters button
   - Updated script version to v22

2. **frontend/app.js**
   - Version updated to v22
   - Added `getCurrentSearchParams()` helper
   - Updated `loadPolls()` to accept search parameters
   - Added search input event listener with debouncing
   - Added sort select event listener
   - Added date input event listeners
   - Added clear filters event listener
   - Updated filter button listeners to pass search params

3. **frontend/styles.css**
   - Added `.search-filter-bar` styles
   - Added `.search-wrapper` styles
   - Added `.search-input` styles with focus states
   - Added `.advanced-filters` flexbox layout
   - Added `.sort-select` and `.date-input` styles
   - Added `.clear-filters-btn` styles
   - Added mobile responsive styles at 768px breakpoint

### Backend
1. **backend/routers/polls.py**
   - Added `timedelta` import
   - Updated `list_polls()` endpoint signature
   - Added search parameter handling
   - Added sort_by parameter with 4 modes
   - Added date_from parameter
   - Added date_to parameter
   - Implemented search query with OR condition
   - Implemented sort by votes with subquery
   - Implemented sort by likes with subquery
   - Implemented date range filtering

## API Examples

### Search Polls
```
GET /api/polls?search=climate&active_only=false
```

### Sort by Most Voted
```
GET /api/polls?sort_by=most-voted&active_only=false
```

### Filter by Date Range
```
GET /api/polls?date_from=2024-01-01&date_to=2024-12-31&active_only=false
```

### Combined Filters
```
GET /api/polls?search=tech&sort_by=most-liked&date_from=2024-01-01&active_only=false
```

## Future Enhancements

Potential improvements for next versions:
- [ ] Category/tag filtering (requires categories feature first)
- [ ] Advanced search operators (AND, OR, NOT)
- [ ] Search history/suggestions
- [ ] Saved filter presets
- [ ] Export filtered results
- [ ] URL parameters for shareable filtered views
- [ ] Fuzzy search / typo tolerance
- [ ] Search within comments
- [ ] Filter by number of votes/likes range
- [ ] Filter by poll creator

## Known Limitations

1. **Search Performance**: Large datasets may require full-text search indexing
2. **Date Picker**: Native date input varies by browser
3. **Sort Accuracy**: Vote/like counts calculated at query time (not cached)

## Conclusion

The Search & Advanced Filters feature significantly enhances poll discoverability and organization. Users can now quickly find specific polls, sort by engagement metrics, and filter by creation date. The implementation follows best practices for performance, UX, and accessibility.

**Next Feature**: Poll Templates (from todo list)
