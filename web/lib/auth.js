import React from 'react';

import { Redirect, Route } from 'react-router-dom';
import { message } from 'antd';
import { useEffect } from 'react';
import { useMutation, useQuery } from '@apollo/react-hooks';
import firebase, { initialize } from '~/integrations/firebase';
import gql from 'graphql-tag';

export const ME = gql`
  query Me {
    me {
      id
      name
      email
    }
  }
`;

export function useMe(options) {
  const { data, ...rest } = useQuery(ME, options);
  return { me: data?.me, ...rest };
}

export const LOGIN = gql`
  mutation Login($token: String!) {
    login(token: $token) {
      id
    }
  }
`;

export const LOGOUT = gql`
  mutation Logout {
    logout
  }
`;

// CMA-TODO: add appropriate providers
const PROVIDERS = {
  GOOGLE: () => new firebase.auth.GoogleAuthProvider(),
  FACEBOOK: () => new firebase.auth.FacebookAuthProvider(),
};

export function useAuth() {
  useEffect(() => {
    initialize();
  }, []);
}

// https://firebase.google.com/docs/auth/web/facebook-login?#handling-account-exists-with-different-credential-errors
// i.e. when I sign up with Google but already have Facebook linked
// CMA-TODO: add appropriate providers
const CREDENTIAL_METHOD_TO_SITE = {
  'google.com': 'Google',
  'facebook.com': 'Facebook',
};
async function handleAccountExistsWithDifferentCredential(email) {
  const method = (await firebase.auth().fetchSignInMethodsForEmail(email))[0];
  const site = CREDENTIAL_METHOD_TO_SITE[method];
  message.warn(
    `You've already signed up before -- try logging in with ${site}!`
  );
}

export function useSignupOrLogin() {
  const [loginMutation] = useMutation(LOGIN);

  return async function signupOrLogin(provider) {
    try {
      await firebase.auth().signInWithPopup(PROVIDERS[provider]());
    } catch (err) {
      if (err.code === 'auth/account-exists-with-different-credential') {
        handleAccountExistsWithDifferentCredential(err.email);
        return;
      } else {
        throw err;
      }
    }

    const token = await firebase.auth().currentUser.getIdToken();
    await loginMutation({
      variables: { token },
      refetchQueries: ['Me'],
      awaitRefetchQueries: true,
    });
  };
}

export function useLogout() {
  const [logoutMutation] = useMutation(LOGOUT);

  return async function logout() {
    await firebase.auth().signOut();
    await logoutMutation({ refetchQueries: ['Me'], awaitRefetchQueries: true });
  };
}

function AuthRedirect({ component: Component, requires, ...rest }) {
  const { me, loading } = useMe();
  if (loading) return null;

  switch (requires) {
    // Requires viewer to be logged out.
    case 'NO_USER': {
      if (me) return <Redirect to={'/'} />;
      break;
    }
    // Requires user to be logged in, otherwise will direct to /signup
    case 'USER': {
      if (!me) return <Redirect to="/signup" />;
      break;
    }
    default:
      throw new Error(`Unrecognized auth role ${requires}`);
  }

  return <Component {...rest} />;
}

export function AuthRoute({ component, requires = 'USER', ...routeProps }) {
  return (
    <Route
      render={props => (
        <AuthRedirect requires={requires} component={component} {...props} />
      )}
      {...routeProps}
    />
  );
}
