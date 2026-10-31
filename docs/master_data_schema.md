# FulfillSmart master data – schema reference

All records are synthetic. PIN codes are six-digit, Indian-format test values generated for this project; they are not verified postal addresses or a real postal directory. Holiday entries are a simulation calendar, not an authoritative public-holiday feed.

## Files and keys

- `skus.csv`: PK `sku_id`; product catalogue and physical dimensions.
- `fulfillment_nodes.csv`: PK `node_id`; warehouse/node master.
- `delivery_zones.csv`: PK `delivery_zone_id`; synthetic customer destination service zones and test PIN codes.
- `inventory.csv`: PK `inventory_id`; unique business key (`node_id`, `sku_id`); FKs to nodes and SKUs. `available_qty = on_hand_qty - reserved_qty`.
- `carriers.csv`: PK `carrier_id`; carrier master.
- `service_levels.csv`: PK `service_level_id`; FK `carrier_id`; one carrier has STANDARD, EXPRESS and SAME_DAY service definitions.
- `carrier_service_zones.csv`: PK `carrier_service_zone_id`; unique business key (`carrier_id`, `delivery_zone_id`); FKs to carriers and delivery zones.
- `warehouse_capacity.csv`: PK `capacity_id`; unique business key (`node_id`, `capacity_date`); daily order and unit capacity. Allocated counters start at zero.
- `carrier_calendar.csv`: PK `carrier_calendar_id`; unique business key (`carrier_id`, `calendar_date`); carrier operating days and pickup cutoff.
- `holidays.csv`: PK `holiday_id`; synthetic holiday calendar. `state_scope=ALL` means all simulation regions.

## Conventions

- IDs are stable within a generation run and generated from seed `20261022`.
- All dates use ISO `YYYY-MM-DD`; timestamps use ISO 8601 with India offset.
- Quantities are non-negative integers; prices and weights are numeric.
- `SAME_DAY` is a service definition only. The allocation/promise engine must additionally enforce same-day zone coverage, cutoff, stock and capacity.
- Capacity is recorded separately in `max_orders` and `max_units`; allocation must reserve both to prevent overbooking.
- Carrier coverage is represented by `carrier_service_zones.csv`; availability flags are service-specific.
- Destination PIN codes are synthetic test identifiers and must not be used for actual shipping.
