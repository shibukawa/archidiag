import { arrangeView } from './arrange'
import { createGroup, createView, setElementGroup, setPositions } from './commands'
import { emptyProject, type Element, type Project, type Relationship } from './model'

/** Built-in Commerce Platform starter: every C4 kind, a data store cylinder, groups, and a second container view. */
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
  ;[context.view, containers.view, payments.view, components.view, webScreens.view, adminScreens.view].forEach((view) => {
    const arranged = arrangeView(project, project.views[view.id])
    project = setPositions(project, view.id, arranged.positions, arranged.boundary)
  })
  return project
}
