import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import Colors from "@/constants/colors";
import { useApp } from "@/lib/context";
import SubscriptionLockScreen from "@/components/SubscriptionLockScreen";
import { ADMIN_PHONE } from "@/lib/types";

const C = Colors.light;

function NativeTabLayout() {
  const { profile, navigationMode } = useApp();
  const isCustomer = profile?.role === 'customer';
  const isTeacher = profile?.role === 'teacher';
  const isSupplier = profile?.role === 'supplier';
  const isShopkeeper = profile?.role === 'shopkeeper';

  const getRoleTab = () => {
    if (isTeacher) return { name: 'content', icon: 'radio', label: 'Live' };
    if (isSupplier || isShopkeeper) return { name: 'products', icon: 'cube', label: 'My Store' };
    return { name: 'marketplace', icon: 'bag', label: 'Shop' };
  };

  const roleTab = getRoleTab();

  if (isCustomer) {
    return (
      <NativeTabs initialRouteName="customer-home">
        <NativeTabs.Trigger name="customer-home">
          <Icon sf={{ default: "house", selected: "house.fill" }} />
          <Label>Home</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="directory">
          <Icon sf={{ default: "wrench.and.screwdriver", selected: "wrench.and.screwdriver.fill" }} />
          <Label>Find Nearby</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="nearby-shops">
          <Icon sf={{ default: "storefront", selected: "storefront.fill" }} />
          <Label>Nearby Shops</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="orders">
          <Icon sf={{ default: "wrench.adjustable", selected: "wrench.adjustable.fill" }} />
          <Label>Ask for Repair</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="support" hidden />
        <NativeTabs.Trigger name="index" hidden />
        <NativeTabs.Trigger name="jobs" hidden />
        <NativeTabs.Trigger name="content" hidden />
        <NativeTabs.Trigger name="products" hidden />
        <NativeTabs.Trigger name="marketplace" hidden />
        <NativeTabs.Trigger name="create" hidden />
        <NativeTabs.Trigger name="profile" hidden />
      </NativeTabs>
    );
  }

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="directory">
        <Icon sf={{ default: "person.2", selected: "person.2.fill" }} />
        <Label>Directory</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="create">
        <Icon sf={{ default: "plus.circle", selected: "plus.circle.fill" }} />
        <Label>Post</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name={roleTab.name}>
        <Icon sf={{ default: roleTab.icon, selected: `${roleTab.icon}.fill` }} />
        <Label>{roleTab.label}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="customer-home" hidden />
      <NativeTabs.Trigger name="nearby-shops" hidden />
      <NativeTabs.Trigger name="orders" hidden />
      <NativeTabs.Trigger name="jobs" hidden />
      <NativeTabs.Trigger name="technician-jobs" hidden />
      <NativeTabs.Trigger name="content" hidden={!isTeacher} />
      <NativeTabs.Trigger name="products" hidden={!isSupplier && !isShopkeeper} />
      <NativeTabs.Trigger name="marketplace" hidden={isTeacher || isSupplier || isShopkeeper} />
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";
  const { profile, navigationMode } = useApp();
  const isCustomer = profile?.role === 'customer';
  const isTeacher = profile?.role === 'teacher';
  const isSupplier = profile?.role === 'supplier';
  const isShopkeeper = profile?.role === 'shopkeeper';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.tabIconSelected,
        tabBarInactiveTintColor: C.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : C.surface,
          borderTopWidth: 1,
          borderTopColor: C.border,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          height: isWeb ? 84 : undefined,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: C.surface },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="customer-home"
        options={{
          title: isCustomer ? "Home" : "Find",
          href: isCustomer ? '/customer-home' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Feed",
          href: isCustomer ? null : '/',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: "Support",
          href: null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "headset" : "headset-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: isCustomer ? "Ask for Repair" : "Orders",
          href: isCustomer ? '/orders' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "list" : "list-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="nearby-shops"
        options={{
          title: "Nearby Shops",
          href: isCustomer ? '/nearby-shops' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "storefront" : "storefront-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="directory"
        options={{
          title: isCustomer ? "Find Nearby" : "Directory",
          href: '/directory',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={isCustomer ? (focused ? "construct" : "construct-outline") : (focused ? "people" : "people-outline")}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Post",
          href: isCustomer ? null : '/create',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "add-circle" : "add-circle-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="content"
        options={{
          title: "Content",
          href: isTeacher && navigationMode === 'default' ? '/content' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "book" : "book-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: (isSupplier || isShopkeeper) ? "My Store" : "Products",
          href: (isSupplier || isShopkeeper) && navigationMode === 'default' ? '/products' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "cube" : "cube-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: "Shop",
          href: !isCustomer && !isTeacher && !isSupplier && !isShopkeeper && navigationMode === 'default' ? '/marketplace' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "bag" : "bag-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: "Jobs",
          href: null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "briefcase" : "briefcase-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="technician-jobs"
        options={{
          title: "Jobs",
          href: null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "construct" : "construct-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          href: isCustomer ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  const { profile } = useApp();
  const cleanPhone = profile?.phone?.replace(/\D/g, "");
  const isAdmin = profile?.role === 'admin' || cleanPhone === "8179142535" || cleanPhone === "9876543210" || profile?.email === 'atozmobilerepaircourse@gmail.com';
  const needsSub = (profile?.role === 'technician' || profile?.role === 'supplier' || profile?.role === 'shopkeeper' || profile?.role === 'teacher') && !isAdmin;

  const tabs = isLiquidGlassAvailable() ? <NativeTabLayout /> : <ClassicTabLayout />;

  if (needsSub) {
    return <SubscriptionLockScreen>{tabs}</SubscriptionLockScreen>;
  }

  return tabs;
}
