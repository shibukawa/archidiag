import { arrangeView } from './arrange'
import { createGroup, createView, setElementGroup, setPositions } from './commands'
import { emptyProject, makeAttribute, type Attribute, type Element, type Project, type Relationship } from './model'

/** Attribute shorthand: "name" or "name!" for important; a leading "#" marks the primary key. */
function fields(specs: string[], descriptions: Record<string, string> = {}): Attribute[] {
  return specs.map((spec) => {
    const primaryKey = spec.startsWith('#')
    const important = spec.endsWith('!') || primaryKey
    const name = spec.replace(/^#/, '').replace(/!$/, '')
    return makeAttribute(name, { important, primaryKey, required: primaryKey || spec.endsWith('!'), unique: primaryKey, description: descriptions[name] ?? '' })
  })
}

/** Built-in Commerce Platform starter: every C4 kind, data stores with ERDs, groups, and a second container view. */
export function commerceStarter(): Project {
  let project = emptyProject('Commerce Platform')
  project = { ...project, id: 'project:commerce-platform' }
  const elements: Element[] = [
    { id: 'person:customer', kind: 'person', name: 'Customer', description: 'A shopper browsing, ordering, and paying.', technology: '' },
    { id: 'person:ops', kind: 'person', name: 'Operations Staff', description: 'Handles fulfillment and refunds.', technology: '' },
    { id: 'system:commerce', kind: 'softwareSystem', name: 'Commerce Platform', description: 'Online commerce platform for browsing, checkout, and fulfillment.', technology: '' },
    { id: 'system:payment', kind: 'externalSystem', name: 'Payment Provider', description: 'Authorizes card payments.', technology: 'HTTPS API' },
    { id: 'system:mail', kind: 'externalSystem', name: 'Email Service', description: 'Sends transactional email.', technology: 'SMTP / REST' },
    { id: 'container:web', kind: 'container', parentId: 'system:commerce', name: 'Web Application', description: 'Customer-facing storefront.', technology: 'React / TypeScript', containerCategory: 'application', applicationKind: 'webBrowser' },
    { id: 'container:admin', kind: 'container', parentId: 'system:commerce', name: 'Admin Console', description: 'Back-office UI for operations.', technology: 'React', containerCategory: 'application', applicationKind: 'webBrowser' },
    { id: 'container:order', kind: 'container', parentId: 'system:commerce', name: 'Order Service', description: 'Cart, checkout, and order lifecycle API.', technology: 'Bun / Hono', containerCategory: 'application', applicationKind: 'server' },
    { id: 'container:worker', kind: 'container', parentId: 'system:commerce', name: 'Order Worker', description: 'Processes order events asynchronously.', technology: 'Bun', containerCategory: 'application', applicationKind: 'worker' },
    { id: 'container:orders-db', kind: 'container', parentId: 'system:commerce', name: 'Orders DB', description: 'Orders, customers, and payments.', technology: 'PostgreSQL 16', containerCategory: 'dataStore', dataStoreKind: 'database', sqlDialect: 'postgresql' },
    { id: 'container:catalog-db', kind: 'container', parentId: 'system:commerce', name: 'Catalog DB', description: 'Products and inventory.', technology: 'SQLite', containerCategory: 'dataStore', dataStoreKind: 'database', sqlDialect: 'sqlite' },
    { id: 'container:events', kind: 'container', parentId: 'system:commerce', name: 'Order Events', description: 'Order lifecycle topic.', technology: 'NATS', containerCategory: 'dataStore', dataStoreKind: 'pubSub' },
    { id: 'component:cart', kind: 'component', parentId: 'container:order', name: 'Cart Controller', description: 'Cart endpoints.', technology: 'Hono router' },
    { id: 'component:order-controller', kind: 'component', parentId: 'container:order', name: 'Order Controller', description: 'Order, checkout, and refund endpoints.', technology: 'Hono router' },
    { id: 'component:checkout', kind: 'component', parentId: 'container:order', name: 'Checkout Service', description: 'Validates the cart, authorizes payment, and records the order.', technology: 'TypeScript' },
    { id: 'component:order-query', kind: 'component', parentId: 'container:order', name: 'Order Query Service', description: 'Reads orders, history, and status for screens.', technology: 'TypeScript' },
    { id: 'component:orders', kind: 'component', parentId: 'container:order', name: 'Order Repository', description: 'Reads and writes orders.', technology: 'SQL' },
    { id: 'component:publisher', kind: 'component', parentId: 'container:order', name: 'Event Publisher', description: 'Publishes order events.', technology: 'NATS client' },
    { id: 'component:products', kind: 'component', parentId: 'container:order', name: 'Product Controller', description: 'Serves product listings and stock.', technology: 'Hono router' },
    // Screens of the web storefront: the C4 book has no example, so a screen list stands in for components.
    { id: 'component:catalog-page', kind: 'component', parentId: 'container:web', name: 'Catalog Page', description: 'Browse and search products.', technology: 'React page' },
    { id: 'component:cart-page', kind: 'component', parentId: 'container:web', name: 'Cart Page', description: 'Review and edit the cart.', technology: 'React page' },
    { id: 'component:checkout-page', kind: 'component', parentId: 'container:web', name: 'Checkout Page', description: 'Enter payment and place the order.', technology: 'React page' },
    { id: 'component:orders-page', kind: 'component', parentId: 'container:web', name: 'Order History Page', description: 'Past orders and their status.', technology: 'React page' },
    // Screens of the admin console.
    { id: 'component:order-list', kind: 'component', parentId: 'container:admin', name: 'Order List Screen', description: 'Search and filter orders.', technology: 'React screen' },
    { id: 'component:order-detail', kind: 'component', parentId: 'container:admin', name: 'Order Detail Screen', description: 'Inspect one order and its payments.', technology: 'React screen' },
    { id: 'component:refund', kind: 'component', parentId: 'container:admin', name: 'Refund Screen', description: 'Issue full or partial refunds.', technology: 'React screen' },
    // Orders DB tables: many columns each, only the important ones show on the card.
    { id: 'entity:customer', kind: 'entity', parentId: 'container:orders-db', volume: { recordBytes: 400, initialRows: 50000, growthRows: 200, growthPeriod: 'day' }, name: 'Customer', description: 'A registered shopper. One row per account; guests get a row at first checkout.', technology: '', classification: 'resource', attributes: fields(['#customer_id', 'email!', 'display_name!', 'phone', 'status!', 'locale', 'marketing_opt_in', 'created_at', 'updated_at'], { email: 'Login and notification address; unique per account.', status: 'active | suspended | closed' }) },
    { id: 'entity:order', kind: 'entity', parentId: 'container:orders-db', volume: { recordBytes: 220, growthRows: 5000, growthPeriod: 'day' }, name: 'Order', description: 'One checkout by a customer. Lines and payments hang off it; status drives fulfillment.', technology: '', classification: 'event', attributes: fields(['#order_id', 'order_number!', 'status!', 'ordered_at!', 'total_amount!', 'currency', 'shipping_address', 'billing_address', 'note', 'created_at', 'updated_at'], { order_number: 'Human-readable number shown to the customer.', status: 'placed | paid | shipped | cancelled | refunded' }) },
    { id: 'entity:order-line', kind: 'entity', parentId: 'container:orders-db', volume: { recordBytes: 120, growthRows: 15000, growthPeriod: 'day' }, name: 'Order Line', description: 'One product in one order at the price charged.', technology: '', classification: 'event', attributes: fields(['#order_line_id', 'product_ref!', 'quantity!', 'unit_price!', 'discount', 'tax_rate', 'created_at'], { product_ref: 'SKU snapshot from the Catalog DB at order time.' }) },
    { id: 'entity:payment', kind: 'entity', parentId: 'container:orders-db', volume: { recordBytes: 160, growthRows: 5000, growthPeriod: 'day' }, name: 'Payment', description: 'An authorization or capture against an order, as reported by the payment provider.', technology: '', classification: 'event', attributes: fields(['#payment_id', 'method!', 'amount!', 'authorized_at!', 'captured_at', 'provider_reference', 'failure_reason', 'created_at']) },
    { id: 'entity:refund', kind: 'entity', parentId: 'container:orders-db', volume: { recordBytes: 140, growthRows: 60, growthPeriod: 'day' }, name: 'Refund', description: 'Money returned for an order, full or partial.', technology: '', classification: 'event', attributes: fields(['#refund_id', 'amount!', 'reason!', 'refunded_at!', 'provider_reference', 'created_at']) },
    // A dependent table: addresses exist only inside their customer (data:entity dependency).
    { id: 'entity:customer-address', kind: 'entity', parentId: 'entity:customer', volume: { recordBytes: 260, initialRows: 60000, growthRows: 300, growthPeriod: 'day' }, name: 'Customer Address', description: 'A shipping or billing address kept on the customer; deleted with it.', technology: '', classification: 'resource', attributes: fields(['#customer_address_id', 'kind!', 'postal_code!', 'line1!', 'line2', 'city', 'country', 'is_default'], { kind: 'shipping | billing' }) },
    // Catalog DB tables.
    { id: 'entity:product', kind: 'entity', parentId: 'container:catalog-db', volume: { recordBytes: 600, initialRows: 20000, growthRows: 50, growthPeriod: 'day' }, name: 'Product', description: 'A sellable item with its listing price.', technology: '', classification: 'resource', attributes: fields(['#product_id', 'sku!', 'name!', 'price!', 'description', 'active', 'created_at', 'updated_at']) },
    { id: 'entity:availability', kind: 'entity', parentId: 'container:catalog-db', volume: { recordBytes: 96, initialRows: 20000, refreshMode: 'rebuild', refreshEvery: 'hourly' }, name: 'Product Availability', description: 'Sellable quantity per product for the storefront: on hand minus reserved.', technology: '', classification: 'summary', storageKind: 'materialized_view', attributes: fields(['sku!', 'name!', 'available_quantity!', 'refreshed_at']) },
    { id: 'entity:inventory', kind: 'entity', parentId: 'container:catalog-db', volume: { recordBytes: 64, initialRows: 20000, growthRows: 50, growthPeriod: 'day' }, name: 'Inventory', description: 'Stock on hand and reserved quantity per product.', technology: '', classification: 'work', attributes: fields(['#inventory_id', 'quantity_on_hand!', 'reserved!', 'updated_at']) },
  ]
  elements.forEach((element) => { project.elements[element.id] = element })
  const relationships: Relationship[] = [
    { id: 'rel:customer-commerce', sourceId: 'person:customer', targetId: 'system:commerce', label: 'shops using', technology: 'HTTPS', viewEndpoints: { container: { sourceId: 'person:customer', targetId: 'container:web' }, component: { sourceId: 'person:customer', targetId: 'component:catalog-page' } } },
    { id: 'rel:ops-commerce', sourceId: 'person:ops', targetId: 'system:commerce', label: 'manages orders in', technology: 'HTTPS', viewEndpoints: { container: { sourceId: 'person:ops', targetId: 'container:admin' }, component: { sourceId: 'person:ops', targetId: 'component:order-list' } } },
    { id: 'rel:commerce-payment', sourceId: 'system:commerce', targetId: 'system:payment', label: 'authorizes payments with', technology: 'HTTPS / JSON', viewEndpoints: { container: { sourceId: 'container:order', targetId: 'system:payment' }, component: { sourceId: 'component:checkout', targetId: 'system:payment' } } },
    { id: 'rel:commerce-mail', sourceId: 'system:commerce', targetId: 'system:mail', label: 'sends email through', technology: 'REST', viewEndpoints: { container: { sourceId: 'container:worker', targetId: 'system:mail' } } },
    // Container-level calls are assigned to the screens and API components that really talk to each other.
    { id: 'rel:web-order', sourceId: 'container:web', targetId: 'container:order', label: 'calls', technology: 'JSON / HTTPS', viewEndpoints: { component: { sourceId: 'component:checkout-page', targetId: 'component:order-controller' } } },
    { id: 'rel:admin-order', sourceId: 'container:admin', targetId: 'container:order', label: 'calls', technology: 'JSON / HTTPS', viewEndpoints: { component: { sourceId: 'component:order-list', targetId: 'component:order-controller' } } },
    { id: 'rel:order-ordersdb', sourceId: 'container:order', targetId: 'container:orders-db', label: 'reads and writes', technology: 'SQL', viewEndpoints: { component: { sourceId: 'component:orders', targetId: 'container:orders-db' } } },
    { id: 'rel:order-catalog', sourceId: 'container:order', targetId: 'container:catalog-db', label: 'reads', technology: 'SQL', viewEndpoints: { component: { sourceId: 'component:products', targetId: 'container:catalog-db' } } },
    { id: 'rel:order-events', sourceId: 'container:order', targetId: 'container:events', label: 'publishes to', technology: 'NATS', viewEndpoints: { component: { sourceId: 'component:publisher', targetId: 'container:events' } } },
    { id: 'rel:catalog-products', sourceId: 'component:catalog-page', targetId: 'component:products', label: 'lists products via', technology: 'JSON / HTTPS' },
    { id: 'rel:cart-page-cart', sourceId: 'component:cart-page', targetId: 'component:cart', label: 'updates the cart via', technology: 'JSON / HTTPS' },
    { id: 'rel:orders-page-orders', sourceId: 'component:orders-page', targetId: 'component:order-controller', label: 'reads order history via', technology: 'JSON / HTTPS' },
    // Screens do not exchange data with each other; the user navigates between them, so no screen-to-screen relationships.
    { id: 'rel:detail-orders', sourceId: 'component:order-detail', targetId: 'component:order-controller', label: 'loads the order via', technology: 'JSON / HTTPS' },
    { id: 'rel:refund-checkout', sourceId: 'component:refund', targetId: 'component:order-controller', label: 'requests refunds via', technology: 'JSON / HTTPS' },
    // Inside Order Service: controllers call services and repositories, never the other way round.
    { id: 'rel:controller-checkout', sourceId: 'component:order-controller', targetId: 'component:checkout', label: 'places orders and refunds via' },
    { id: 'rel:controller-query', sourceId: 'component:order-controller', targetId: 'component:order-query', label: 'reads orders via' },
    { id: 'rel:query-orders', sourceId: 'component:order-query', targetId: 'component:orders', label: 'queries' },
    { id: 'rel:events-worker', sourceId: 'container:events', targetId: 'container:worker', label: 'delivers to', technology: 'NATS' },
    { id: 'rel:worker-ordersdb', sourceId: 'container:worker', targetId: 'container:orders-db', label: 'updates', technology: 'SQL' },
    { id: 'rel:cart-checkout', sourceId: 'component:cart', targetId: 'component:checkout', label: 'starts checkout in' },
    { id: 'rel:checkout-orders', sourceId: 'component:checkout', targetId: 'component:orders', label: 'stores order via' },
    { id: 'rel:checkout-publisher', sourceId: 'component:checkout', targetId: 'component:publisher', label: 'emits events via' },
    // ERD: the many side references the one side (rule: erd-scope-integrity keeps them inside one data store).
    { id: 'rel:order-customer', sourceId: 'entity:order', targetId: 'entity:customer', label: 'placed by', erd: { kind: 'reference', sourceCardinality: '*', targetCardinality: '1', important: true } },
    { id: 'rel:line-order', sourceId: 'entity:order-line', targetId: 'entity:order', label: 'belongs to', erd: { kind: 'reference', sourceCardinality: '1..*', targetCardinality: '1' } },
    { id: 'rel:payment-order', sourceId: 'entity:payment', targetId: 'entity:order', label: 'pays', erd: { kind: 'reference', sourceCardinality: '*', targetCardinality: '1' } },
    { id: 'rel:refund-payment', sourceId: 'entity:refund', targetId: 'entity:payment', label: 'reverses', erd: { kind: 'reference', sourceCardinality: '*', targetCardinality: '1' } },
    { id: 'rel:customer-address', sourceId: 'entity:customer', targetId: 'entity:customer-address', label: 'has', erd: { kind: 'dependent', sourceCardinality: '1', targetCardinality: '*' } },
    { id: 'rel:order-address', sourceId: 'entity:order', targetId: 'entity:customer-address', label: 'ships to', erd: { kind: 'reference', sourceCardinality: '*', targetCardinality: '0..1' } },
    { id: 'rel:availability-product', sourceId: 'entity:availability', targetId: 'entity:product', label: 'derived from', erd: { kind: 'label', sourceCardinality: '1', targetCardinality: '1' } },
    { id: 'rel:availability-inventory', sourceId: 'entity:availability', targetId: 'entity:inventory', label: 'derived from', erd: { kind: 'label', sourceCardinality: '1', targetCardinality: '1' } },
    { id: 'rel:inventory-product', sourceId: 'entity:inventory', targetId: 'entity:product', label: 'tracks stock of', erd: { kind: 'reference', sourceCardinality: '1', targetCardinality: '1' } },
  ]
  relationships.forEach((relationship) => { project.relationships[relationship.id] = relationship })

  const orderDomain = createGroup(project, { scopeId: 'system:commerce', name: 'Order Domain', description: 'Everything that owns orders.' })
  project = orderDomain.project
  const storefront = createGroup(project, { scopeId: 'system:commerce', name: 'Storefront', description: 'Customer-facing surfaces.' })
  project = storefront.project
  ;['container:order', 'container:worker', 'container:orders-db', 'container:events'].forEach((id) => { project = setElementGroup(project, id, orderDomain.group.id) })
  ;['container:web', 'container:admin'].forEach((id) => { project = setElementGroup(project, id, storefront.group.id) })

  const context = createView(project, 'c4_context', null, '')
  project = context.project
  const containers = createView(project, 'c4_container', 'system:commerce', '')
  project = containers.project
  const payments = createView(project, 'c4_container', 'system:commerce', 'Payments')
  project = payments.project
  project = { ...project, views: { ...project.views, [payments.view.id]: { ...payments.view, elementRefs: ['container:web', 'container:order', 'container:orders-db'] } } }
  const components = createView(project, 'c4_component', 'container:order', '')
  project = components.project
  const webScreens = createView(project, 'c4_component', 'container:web', '')
  project = webScreens.project
  const adminScreens = createView(project, 'c4_component', 'container:admin', '')
  project = adminScreens.project
  // The Orders ERD opens in fields mode to show the important-field cards; the Catalog ERD keeps the descriptive default.
  const ordersErd = createView(project, 'erd_component', 'container:orders-db', '')
  project = ordersErd.project
  project = { ...project, views: { ...project.views, [ordersErd.view.id]: { ...ordersErd.view, displayMode: 'fields' } } }
  const catalogErd = createView(project, 'erd_component', 'container:catalog-db', '')
  project = catalogErd.project
  ;[context.view, containers.view, payments.view, components.view, webScreens.view, adminScreens.view, ordersErd.view, catalogErd.view].forEach((view) => {
    const arranged = arrangeView(project, project.views[view.id])
    project = setPositions(project, view.id, arranged.positions, arranged.boundary)
  })
  return project
}
