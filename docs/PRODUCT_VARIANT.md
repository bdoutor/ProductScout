# Product Variant: Automotive Parts Edition

This is the **ProductScout Production** repository - the automotive parts specialist edition.

## Key Differences from Lab

### Target Market
- **Lab (R&D)**: General-purpose price comparison (consumer goods, electronics, groceries)
- **Production**: Automotive parts suppliers (wholesale and retail)

### Authentication
- **Lab**: Public websites only (no login required)
- **Production**: Full authentication support for supplier portals
  - Session management
  - Cookie handling
  - Token-based auth
  - Multi-step login flows

### Features
- **Lab**: Proof of concept, experimental features
- **Production**: 
  - Stable, production-ready code
  - Automotive-specific catalog parsing
  - Part number normalization
  - Compatibility checking
  - Supplier-specific authentication modules

### Use Cases
- Search for brake pads across multiple suppliers
- Find oil filters by OEM part numbers
- Compare prices for specific vehicle parts
- Access authenticated supplier catalogs

## Repository Structure

- **Origin**: https://github.com/bdoutor/ProductScout (this repo)
- **Lab/R&D**: https://github.com/bdoutor/ProductScoutLab (experimental sandbox)

New features are typically prototyped in Lab, then ported to Production after validation.
