# BLCU (Boot Loader Control Unit) Fix Summary

## Issues Fixed

1. **BLCU Board Not Registered**: The BLCU board was never registered with the vehicle, causing all BLCU operations to fail silently.

2. **Frontend/Backend Data Format Mismatch**: 
   - Frontend sends `board` and `file` (base64 encoded) fields
   - Backend expected `Board` and `Data` (raw bytes) fields

3. **Topic Name Mismatch**: The vehicle was listening for the wrong topic names.

4. **Response Format**: Backend wasn't sending proper response format expected by frontend.

## Changes Made

### 1. Updated Request Structures (`pkg/broker/topics/blcu/upload.go`)
- Changed `UploadRequest` to accept `file` field with base64 encoded data
- Added `UploadRequestInternal` for internal processing with decoded bytes
- Added base64 decoding in the handler

### 2. Fixed Response Handling (`pkg/broker/topics/blcu/download.go` & `upload.go`)
- Updated `Push` methods to send proper JSON responses with:
  - `percentage`: Progress indicator (100 for success, 0 for failure)
  - `failure`: Boolean flag
  - `file`: Downloaded data (for download responses)

### 3. Registered BLCU Board (`cmd/main.go`)
- Added BLCU board registration after vehicle setup
- Uses BLCU IP from ADJ configuration

### 4. Fixed Event Handling (`pkg/boards/blcu.go`)
- Updated event constants to use proper types
- Fixed notification type assertions (added pointer types)

### 5. Updated Vehicle UserPush (`pkg/vehicle/vehicle.go`)
- Fixed topic names to match request topics
- Added proper board existence checks
- Handle both UploadRequest and UploadRequestInternal types

## Testing

Created comprehensive tests in:
- `pkg/boards/blcu_integration_test.go` - Integration tests
- `pkg/boards/blcu_simple_test.go` - Simple unit tests

## How It Works Now

1. Frontend sends WebSocket message to `blcu/download` or `blcu/upload` topic
2. Broker topic handler processes the message and calls `UserPush`
3. Vehicle receives the push and notifies the BLCU board
4. BLCU board executes TFTP operations
5. BLCU board sends success/failure response back through broker
6. Frontend receives properly formatted response

## Remaining Considerations

- TFTP server must be running and accessible at the BLCU IP address
- The board name in the request must match a valid board in the ADJ configuration
- File data from frontend must be base64 encoded
- Progress updates during transfer are not yet implemented (TODO comments in code)