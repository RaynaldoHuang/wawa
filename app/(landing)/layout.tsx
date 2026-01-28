import FooterSection from '@/components/layout/Footer';
import NavBar from '@/components/layout/NavigationBar';
import { PropsWithChildren } from 'react';

const LandingLayout = ({ children }: PropsWithChildren) => {
  return (
    <>
      <NavBar />
      {children}
      <FooterSection />
    </>
  );
};
export default LandingLayout;
