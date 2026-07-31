type UserProfileProps = { resource: { read: () => unknown } };

const UserProfile = ({ resource }: UserProfileProps) => {
  const user = resource.read();
  return <div>{JSON.stringify(user)}</div>;
};

export default UserProfile