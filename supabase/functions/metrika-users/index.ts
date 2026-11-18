import { createHandler } from './handler.mjs';

Deno.serve(createHandler({token:Deno.env.get('DASHBOARD_METRIKA_TOKEN')}));
