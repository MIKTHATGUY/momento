import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '../../lib/layout';
import ServiceStatus from '../../components/service-status';
export const metadata = { title: 'Service status' };
export default function StatusPage() {
  return <HomeLayout {...baseOptions}><main className="landing utility-page"><h1>Service status</h1><p>Check whether Momento Timestamp is ready to sign.</p><ServiceStatus /></main></HomeLayout>;
}
