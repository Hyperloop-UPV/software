# Frontend Architecture

The Hyperloop H10 frontend consists of multiple React applications that provide real-time monitoring and control interfaces for pod operations.

## Application Structure

### 1. Control Station (`control-station/`)
The main operational interface for monitoring and controlling the pod.

#### Key Features
- Real-time telemetry visualization
- Order execution interface
- System status monitoring
- Data logging controls
- Protection alerts display

#### Technology Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development
- **Styling**: SCSS Modules for component isolation
- **State Management**: Redux Toolkit + Zustand (mixed approach)
- **WebSocket**: Custom handler for real-time communication
- **Charts**: Recharts for data visualization

### 2. Common Frontend Library (`common-front/`)
Shared components and utilities used across frontend applications.

#### Exported Modules
- **Components**: Reusable UI components
- **WebSocket Handler**: Abstraction for backend communication
- **Models**: TypeScript interfaces for data structures
- **Adapters**: Data transformation utilities
- **Hooks**: Custom React hooks
- **Store**: Shared state management

### 3. Ethernet View (`ethernet-view/`)
Network debugging and monitoring interface.

#### Key Features
- Real-time packet monitoring
- Network statistics display
- Connection status visualization
- Packet inspection tools

## Component Architecture

### Component Hierarchy
```
App
├── Layout
│   ├── Header
│   │   ├── ConnectionStatus
│   │   ├── LoggerControls
│   │   └── Navigation
│   ├── Sidebar
│   │   ├── BoardList
│   │   └── OrderPanel
│   └── MainContent
│       ├── TelemetryDashboard
│       ├── ChartsView
│       └── AlertsPanel
└── Providers
    ├── WsHandlerProvider
    ├── ConfigProvider
    └── ThemeProvider
```

### Key Components

#### WsHandler (WebSocket Management)
```typescript
class WsHandler {
    // Manages WebSocket connection lifecycle
    // Handles subscriptions and message routing
    // Provides reconnection logic
    
    post(topic, payload)      // Send one-way message
    subscribe(topic, callback) // Subscribe to updates
    exchange(topic, request)   // Two-way communication
}
```

#### Order System
```typescript
interface Order {
    id: number;              // From ADJ definition
    fields: Record<string, OrderField>;
}

interface OrderField {
    value: string | number | boolean;
    isEnabled: boolean;
    type: string;           // Data type for encoding
}
```

#### Data Flow
1. **Subscriptions**: Components subscribe to WebSocket topics
2. **Updates**: Real-time data pushed from backend
3. **State Management**: Updates stored in Redux/Zustand
4. **Rendering**: React components re-render on state changes

## State Management

### Redux Store (Legacy)
Used for complex application state:
- Board configurations
- Historical data
- User preferences

### Zustand Stores
Modern stores for specific features:
- **Orders Store**: Order definitions and state
- **Connection Store**: Board connection status
- **Logger Store**: Logging configuration

### Local Component State
Used for:
- UI interactions (modals, dropdowns)
- Form inputs
- Temporary values

## WebSocket Communication

### Topic Subscriptions
```typescript
// Subscribe to data updates
handler.subscribe("podData/update", {
    id: uniqueId,
    cb: (data) => updateTelemetry(data)
});

// Send order
handler.post("order/send", orderPayload);

// Exchange pattern for BLCU
handler.exchange("blcu/upload", request, id, (response) => {
    // Handle progressive updates
});
```

### Message Flow
1. **Connection**: WebSocket connects to backend
2. **Handshake**: Re-establish subscriptions on reconnect
3. **Message Reception**: JSON messages parsed and routed
4. **State Update**: Stores updated with new data
5. **UI Update**: Components re-render

## Performance Optimizations

### Rendering Optimizations
- **React.memo**: Prevent unnecessary re-renders
- **useMemo/useCallback**: Optimize expensive computations
- **Virtualization**: For large data lists
- **Throttling**: Limit update frequency for high-rate data

### Data Management
- **Selective Subscriptions**: Only subscribe to needed data
- **Data Aggregation**: Backend aggregates before sending
- **Caching**: Cache static data locally
- **Cleanup**: Unsubscribe when components unmount

### Bundle Optimization
- **Code Splitting**: Lazy load heavy components
- **Tree Shaking**: Remove unused code
- **Compression**: Gzip/Brotli for production
- **CDN**: Serve static assets from CDN

## Development Workflow

### Project Structure
```
control-station/
├── src/
│   ├── components/     # UI components
│   ├── pages/         # Page-level components
│   ├── services/      # API and WebSocket
│   ├── hooks/         # Custom hooks
│   ├── styles/        # Global styles
│   └── types/         # TypeScript definitions
├── public/            # Static assets
└── vite.config.ts    # Build configuration
```

### Development Tools
- **Vite Dev Server**: Hot module replacement
- **TypeScript**: Type checking and IntelliSense
- **ESLint**: Code quality enforcement
- **Prettier**: Code formatting
- **React DevTools**: Component debugging

### Building and Deployment
```bash
# Development
npm run dev          # Start dev server

# Production
npm run build       # Create production build
npm run preview     # Preview production build
```

## Common Patterns

### Custom Hooks
```typescript
// WebSocket subscription hook
function useSubscription<T>(topic: string, callback: (data: T) => void) {
    const handler = useWsHandler();
    
    useEffect(() => {
        const id = nanoid();
        handler.subscribe(topic, { id, cb: callback });
        return () => handler.unsubscribe(topic, id);
    }, [topic]);
}
```

### Error Boundaries
```typescript
class ErrorBoundary extends Component {
    // Catch and display errors gracefully
    // Log errors to monitoring service
    // Provide fallback UI
}
```

### Loading States
```typescript
function DataPanel() {
    const { data, loading, error } = useData();
    
    if (loading) return <Spinner />;
    if (error) return <ErrorMessage error={error} />;
    return <DataDisplay data={data} />;
}
```

## Testing Strategy

### Unit Tests
- Component logic testing
- Hook behavior verification
- Utility function testing

### Integration Tests
- WebSocket communication
- State management flows
- User interaction scenarios

### E2E Tests
- Critical user journeys
- Cross-browser compatibility
- Performance benchmarks

## Security Considerations

### Current Implementation
- No authentication (trusted network)
- Input validation on forms
- XSS protection via React
- Content Security Policy headers

### Recommended Improvements
- Token-based authentication
- Request signing
- Rate limiting
- Audit logging

## Future Enhancements

### Planned Features
1. **Real-time Collaboration**: Multi-user support
2. **Advanced Visualizations**: 3D pod representation
3. **Machine Learning**: Anomaly detection
4. **Mobile Support**: Responsive design
5. **Offline Mode**: Local data caching

### Technical Improvements
1. **Type Generation**: Auto-generate from ADJ
2. **Component Library**: Storybook documentation
3. **Performance Monitoring**: Real user metrics
4. **Accessibility**: WCAG compliance
5. **Internationalization**: Multi-language support