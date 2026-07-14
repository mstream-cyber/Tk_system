import { supabase } from '../supabase';

async function listAllFiles(prefix: string): Promise<string[]> {
  const paths: string[] = [];
  const { data: entries, error } = await supabase.storage
    .from('payment-receipts')
    .list(prefix);

  if (error) throw new Error(`Failed to list ${prefix}: ${error.message}`);
  if (!entries) return paths;

  for (const entry of entries) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id) {
      paths.push(fullPath);
    } else {
      const nested = await listAllFiles(fullPath);
      paths.push(...nested);
    }
  }

  return paths;
}

async function main() {
  console.log('=== Orphaned Receipt Cleanup ===\n');

  const storagePaths = await listAllFiles('receipts');

  if (storagePaths.length === 0) {
    console.log('No files found in storage bucket.');
    process.exit(0);
  }

  console.log(`Storage files found: ${storagePaths.length}\n`);
  storagePaths.forEach((p) => console.log(`  ${p}`));

  const { data: orders, error: dbErr } = await supabase
    .from('orders')
    .select('receipt_url')
    .not('receipt_url', 'is', null);

  if (dbErr) {
    console.error('Failed to query orders:', dbErr.message);
    process.exit(1);
  }

  const validPaths = new Set(orders.map((o) => o.receipt_url));

  console.log(`\nReceipts referenced in DB: ${validPaths.size}`);
  console.log(`\nValid paths:\n`);
  validPaths.forEach((p) => console.log(`  ${p}`));

  const orphaned = storagePaths.filter((p) => !validPaths.has(p));

  if (orphaned.length === 0) {
    console.log('\nNo orphaned receipts found. Nothing to clean up.');
    process.exit(0);
  }

  console.log(`\nOrphaned receipts to delete: ${orphaned.length}\n`);
  orphaned.forEach((p) => console.log(`  ${p}`));

  console.log('\nDeleting...');
  const { error: delErr } = await supabase.storage
    .from('payment-receipts')
    .remove(orphaned);

  if (delErr) {
    console.error('Failed to delete orphaned files:', delErr.message);
    process.exit(1);
  }

  console.log(`\n✓ Successfully deleted ${orphaned.length} orphaned receipts.`);

  const remaining = await listAllFiles('receipts');
  console.log(`Remaining files in bucket: ${remaining.length}\n`);
  remaining.forEach((p) => console.log(`  ${p}`));

  console.log('\n=== Done ===');
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
