function buildIdentityLoadUsersPortJava() {
  return `package com.prooweb.generated.identity.domain.port.out;

import com.prooweb.generated.identity.domain.model.UserAccount;
import java.util.List;

public interface LoadUsersPort {
  List<UserAccount> loadUsers();
}
`;
}

module.exports = {
  buildIdentityLoadUsersPortJava,
};
