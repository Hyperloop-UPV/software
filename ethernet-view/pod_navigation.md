# Pod Navigation System

This document defines the components and backend modules that will make dynamic point-to-point navigation posible.

## Protocol

When the VCU is `IDLE`, one of the available orders is `start_traction`. If we hit that, the next state order we receive is `custom_route`. This order acceptes an unlimited number of position + velocity pairs, which indicate the route the vehicle is going to follow. To perform this, the frontend will send an order which follows a different structure from what the other orders are.

## Frontend

The frontend will actually send separate orders.
