const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className='text-center flex-center mx-auto max-w-7xl px-4 md:px-6 py-6'>
      {children}
    </div>
  );
};
export default AuthLayout;
