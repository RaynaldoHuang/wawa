import FooterSection from '@/components/layout/Footer';
import NavBar from '@/components/layout/NavigationBar';

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <NavBar />
      <div className='text-center flex-center mx-auto max-w-7xl px-4 md:px-6 py-6'>
        {children}
      </div>
      <FooterSection />
    </>
  );
};
export default AuthLayout;
